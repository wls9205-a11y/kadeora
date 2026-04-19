/**
 * [CI-v1 Phase 2] issue-alerts 적체 backfill
 *
 * 1,161건 draft 상태 이슈를 6시간 cron 으로 50건/run 씩 전 파이프 인라인 처리.
 * fact_check → image_attach → seo_enrich → publish 를 단일 라우트에서 순차 수행.
 *
 * 인증:
 *   - pg_cron / Vercel cron 호출: verifyCronAuth
 *   - 어드민 수동 호출: requireAdmin (GET/POST 둘 다 지원)
 *
 * fact_check 는 Claude 비용 회피 위해 **결정적 룰 기반**:
 *   - content_length >= 1200
 *   - 금지 표현 없음
 *   - FAQ/내부링크 존재
 *   통과 시 confidence=70, 실패 시 false + reasons
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 300;
export const runtime = 'nodejs';

const MAX_PER_RUN = 50;
const PREEMPT_MS = 270_000;

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

const IMG_BLOCK_DOMAINS = [
  'utoimage', 'freepik', 'shutterstock', 'pixabay', 'unsplash', 'istockphoto',
  'namu.wiki', 'wikipedia', 'youtube.com', 'pinimg.com', 'ohousecdn',
  'blog.kakaocdn.net/dn/0/', 'tistory.com/image/0/',
  'hogangnono', 'new.land.naver.com', 'landthumb', 'kbland', 'kbstar.com',
  'zigbang', 'dabang', 'dcinside', 'ruliweb.com', 'ppomppu.co.kr',
];

const CAT_IMG_QUERY: Record<string, string[]> = {
  apt: ['아파트 단지 전경', '아파트 분양 현장', '신축 아파트 외관'],
  unsold: ['미분양 아파트 현장', '아파트 빈 단지'],
  redev: ['재개발 현장', '재건축 아파트 철거', '도시정비 사업'],
  stock: ['주식 증권 차트', '코스피 거래소', '증권 시장 분석'],
  finance: ['재테크 자산관리', '금융 투자 적금', '예금 비교'],
  general: ['경제 분석 리포트', '데이터 분석 차트', '정보 그래프'],
};

const BANNED_WORDS = [
  '매수 추천', '매도 추천', '반드시 오를', '반드시 내릴',
  '급등 예상', '급락 예상', '목표가', '적정가', '저점 매수',
  '꼭 사야', '꼭 팔아야',
];

interface NaverImg { url: string; alt: string; caption: string; }

async function fetchNaverImages(query: string, display = 10): Promise<NaverImg[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim&filter=large`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.items || [];
    return items
      .filter((it) => {
        const w = parseInt(it?.sizewidth || '0');
        const h = parseInt(it?.sizeheight || '0');
        if (w < 400 || h < 250) return false;
        const u = String(it?.link || '').toLowerCase();
        if (!u) return false;
        if (IMG_BLOCK_DOMAINS.some((d) => u.includes(d))) return false;
        return true;
      })
      .map((it) => {
        const link = String(it.link || '').replace(/^http:\/\//, 'https://');
        let host = '웹';
        try { host = new URL(link).hostname; } catch {}
        return { url: link, alt: String(it.title || query).replace(/<[^>]*>/g, ''), caption: `출처: ${host}` };
      });
  } catch {
    return [];
  }
}

function deterministicFactCheck(issue: any): { passed: boolean; confidence: number; issues: string[] } {
  const issues: string[] = [];
  const content = String(issue.draft_content || '');
  if (content.length < 1200) issues.push(`content_too_short:${content.length}`);
  for (const w of BANNED_WORDS) if (content.includes(w)) issues.push(`banned:${w}`);
  if (!/FAQ|자주 묻는 질문|Q\.[\s\S]*?A\./.test(content)) issues.push('no_faq');
  if (!/\]\(\/(stock|apt|feed|blog)/.test(content)) issues.push('no_internal_link');
  const passed = issues.length === 0;
  const confidence = passed ? 70 : Math.max(30, 70 - issues.length * 10);
  return { passed, confidence, issues };
}

function ensureContentHasEssentials(content: string, category: string): string {
  let c = content;
  if (!/\]\(\/(stock|apt|feed|blog)/.test(c)) {
    const linkBlock: Record<string, string> = {
      apt: '\n\n> 🏠 [카더라 청약 일정](/apt) | [부동산 블로그](/blog?category=apt)\n',
      unsold: '\n\n> 📉 [미분양 현황](/apt?tab=unsold) | [청약 일정](/apt)\n',
      redev: '\n\n> 🏗 [재개발 정보](/blog?category=redev) | [청약 일정](/apt)\n',
      stock: '\n\n> 📊 [카더라 주식 시황](/stock) | [투자 블로그](/blog?category=stock)\n',
      finance: '\n\n> 💰 [재테크 정보](/stock) | [부동산 정보](/apt)\n',
      general: '\n\n> 📌 [카더라 커뮤니티](/feed) | [블로그](/blog)\n',
    };
    c += linkBlock[category] || linkBlock.general;
  }
  if (!/FAQ|자주 묻는 질문|Q\.[\s\S]*?A\./.test(c)) {
    c += `\n\n## 자주 묻는 질문\n\n**Q. 이 정보의 출처는 어디인가요?**\n\nA. 본 기사는 공공 데이터와 언론 보도를 바탕으로 카더라가 자체 분석한 내용입니다.\n\n**Q. 투자·매수 결정에 참고해도 되나요?**\n\nA. 참고는 가능하지만 최종 결정은 본인 책임입니다. [카더라 블로그](/blog)에서 관련 글을 확인하세요.\n\n**Q. 이후 업데이트는 어떻게 확인하나요?**\n\nA. [피드](/feed)에서 실시간 소식을 확인할 수 있습니다.`;
  }
  return c;
}

function stripMarkdown(s: string): string {
  return (s || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[#*>`|_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function composeMeta(current: string | null | undefined, title: string, summary: string | null | undefined, content: string): string {
  const cur = (current || '').trim();
  if (cur.length >= 150 && cur.length <= 160) return cur;
  const srcParts = [summary, content].filter(Boolean).map((s) => stripMarkdown(String(s)));
  let joined = srcParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) joined = title;
  let base = joined.slice(0, 160);
  if (base.length < 150) base = `${title} — ${joined}`.replace(/\s+/g, ' ').trim().slice(0, 160);
  if (base.length < 150) base = (base + ' · 카더라 데이터 분석').slice(0, 160);
  return base;
}

function buildArticleJsonLd(p: {
  title: string; description: string; slug: string; coverImage: string | null;
  category: string; tags: string[]; publishedAt: string | null; updatedAt: string | null; authorName: string;
}): Record<string, any> {
  const url = `${SITE_URL.replace(/\/$/, '')}/blog/${p.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: p.title.slice(0, 110),
    description: p.description,
    image: p.coverImage ? [p.coverImage] : undefined,
    datePublished: p.publishedAt || new Date().toISOString(),
    dateModified: p.updatedAt || new Date().toISOString(),
    articleSection: p.category,
    keywords: (p.tags || []).slice(0, 12).join(','),
    author: { '@type': 'Organization', name: p.authorName || '카더라', url: SITE_URL },
    publisher: {
      '@type': 'Organization', name: '카더라', url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL.replace(/\/$/, '')}/logo.png` },
    },
    inLanguage: 'ko-KR',
    url,
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

async function runBackfill(): Promise<any> {
  const sb = getSupabaseAdmin();
  const start = Date.now();

  // 적체 대상: draft 있고 최종 발행까지 완료 안 된 것 중 오래된 순
  const { data: pending, error: fetchErr } = await (sb as any)
    .from('issue_alerts')
    .select('id, title, summary, category, sub_category, draft_title, draft_content, draft_slug, draft_keywords, detected_keywords, related_entities, fact_check_passed, image_attached_at, seo_enriched_at, blog_post_id, is_published, final_score, detected_at')
    .not('draft_content', 'is', null)
    .or('is_published.eq.false,is_published.is.null')
    .order('final_score', { ascending: false })
    .limit(MAX_PER_RUN);

  if (fetchErr) return { processed: 0, failed: 1, metadata: { error: fetchErr.message } };
  if (!pending || pending.length === 0) return { processed: 0, metadata: { message: 'no backlog' } };

  const stats = {
    processed: 0, fact_check_passed: 0, fact_check_failed: 0,
    finalized: 0, seo_enriched: 0, published: 0, gate_blocked: 0, skipped: 0, failed: 0,
  };
  const failures: string[] = [];

  for (const issue of pending as any[]) {
    if (Date.now() - start > PREEMPT_MS) break;
    stats.processed++;

    try {
      // === STAGE 1: fact_check (결정적 룰) ===
      if (issue.fact_check_passed === null) {
        const fc = deterministicFactCheck(issue);
        await (sb as any).from('issue_alerts').update({
          fact_check_passed: fc.passed,
          fact_check_confidence: fc.confidence,
          fact_check_details: { issues: fc.issues, confidence: fc.confidence, model: 'deterministic-rule' },
          fact_check_at: new Date().toISOString(),
        }).eq('id', issue.id);
        if (fc.passed) {
          stats.fact_check_passed++;
          try { await (sb as any).rpc('advance_issue_stage', { p_issue_id: issue.id, p_stage: 'fact_check' }); } catch {}
          issue.fact_check_passed = true;
        } else {
          stats.fact_check_failed++;
          failures.push(`${issue.id}:fc:${fc.issues.slice(0, 2).join(',')}`);
          continue;
        }
      }

      if (!issue.fact_check_passed) { stats.skipped++; continue; }

      // === STAGE 2: image_attach ===
      if (!issue.image_attached_at) {
        const { data: normCat } = await (sb as any).rpc('normalize_category', { p_input: issue.category || 'general' });
        const category = String(normCat || 'general');

        const enriched = ensureContentHasEssentials(String(issue.draft_content || ''), category);
        if (enriched !== issue.draft_content) {
          await (sb as any).from('issue_alerts').update({ draft_content: enriched }).eq('id', issue.id);
          issue.draft_content = enriched;
        }

        let postId = issue.blog_post_id ? Number(issue.blog_post_id) : null;
        if (!postId) {
          const { data: finId, error: finErr } = await (sb as any).rpc('finalize_issue_to_post', { p_issue_id: issue.id });
          if (finErr || !finId) {
            failures.push(`${issue.id}:finalize:${finErr?.message || ''}`);
            stats.failed++;
            continue;
          }
          postId = Number(finId);
          stats.finalized++;
        }

        // Naver 이미지 수집 (최대 6 real)
        const entities: string[] = Array.isArray(issue.related_entities) ? issue.related_entities.slice(0, 2) : [];
        const keywords: string[] = Array.isArray(issue.detected_keywords) ? issue.detected_keywords.slice(0, 3) : [];
        const seed = entities[0] || keywords[0] || issue.title || '';
        const catQ = CAT_IMG_QUERY[category] || CAT_IMG_QUERY.general;
        const queries = [seed ? `${seed} ${catQ[0]}` : catQ[0], catQ[0], catQ[1], catQ[2]].filter(Boolean) as string[];
        const collected: NaverImg[] = [];
        for (const q of queries) {
          if (collected.length >= 7) break;
          const imgs = await fetchNaverImages(q, 10);
          for (const im of imgs) {
            if (collected.length >= 7) break;
            if (collected.some((c) => c.url === im.url)) continue;
            collected.push(im);
          }
          await new Promise((r) => setTimeout(r, 100));
        }

        const realImageSlots = Math.min(collected.length, 6);
        for (let i = 0; i < realImageSlots; i++) {
          const img = collected[i];
          try {
            await (sb as any).rpc('record_blog_image', {
              p_post_id: postId, p_position: i, p_image_url: img.url, p_image_kind: null,
              p_alt_text: img.alt.slice(0, 200), p_caption: img.caption.slice(0, 200), p_storage_path: null,
            });
          } catch {}
        }
        const designA = 1 + (Math.abs(hashString(issue.draft_title || '')) % 6);
        const designB = 1 + ((designA % 6) + 1) % 6;
        const ogA = `https://kadeora.app/api/og?title=${encodeURIComponent(String(issue.draft_title || '').slice(0, 40))}&category=${category}&author=${encodeURIComponent('카더라 속보팀')}&design=${designA}`;
        const ogB = `https://kadeora.app/api/og?title=${encodeURIComponent(String(issue.draft_title || '').slice(0, 40))}&category=${category}&author=${encodeURIComponent('카더라 속보팀')}&design=${designB}`;
        for (const [pos, url] of [[6, ogA], [7, ogB]] as const) {
          try {
            await (sb as any).rpc('record_blog_image', {
              p_post_id: postId, p_position: pos, p_image_url: url, p_image_kind: null,
              p_alt_text: `${issue.draft_title || ''} — 카더라 인포그래픽`.slice(0, 200),
              p_caption: `카더라 ${category} 데이터 분석`.slice(0, 200), p_storage_path: null,
            });
          } catch {}
        }

        const postUpdates: Record<string, any> = {};
        if (collected[0]) {
          postUpdates.cover_image = collected[0].url;
          postUpdates.image_alt = collected[0].alt.slice(0, 200);
        }
        const { data: postRow } = await sb.from('blog_posts').select('excerpt, image_alt').eq('id', postId).maybeSingle();
        if (postRow) {
          const curEx = String((postRow as any).excerpt || '');
          if (curEx.length < 80) {
            const src = (issue.summary && String(issue.summary).length > 80)
              ? String(issue.summary)
              : String(issue.draft_content || '').replace(/[#*>`|_~\[\]\(\)!]/g, ' ').replace(/\s+/g, ' ').trim();
            postUpdates.excerpt = ((curEx ? curEx + ' · ' : '') + src).slice(0, 240);
          }
          if (!(postRow as any).image_alt && !postUpdates.image_alt) {
            postUpdates.image_alt = String(issue.draft_title || '').slice(0, 200);
          }
        }
        if (Object.keys(postUpdates).length > 0) {
          try { await sb.from('blog_posts').update(postUpdates).eq('id', postId); } catch {}
        }

        await (sb as any).from('issue_alerts').update({
          image_attached_at: new Date().toISOString(),
          blog_post_id: postId,
        }).eq('id', issue.id);
        try { await (sb as any).rpc('advance_issue_stage', { p_issue_id: issue.id, p_stage: 'image' }); } catch {}
        issue.image_attached_at = new Date().toISOString();
        issue.blog_post_id = postId;
      }

      // === STAGE 3: seo_enrich ===
      if (issue.image_attached_at && !issue.seo_enriched_at && issue.blog_post_id) {
        const { data: post } = await sb.from('blog_posts')
          .select('id, slug, title, content, excerpt, category, tags, cover_image, meta_description, metadata, published_at, updated_at, author_name')
          .eq('id', issue.blog_post_id).maybeSingle();
        if (post) {
          const newMeta = composeMeta((post as any).meta_description, post.title, issue.summary, post.content);
          const jsonLd = buildArticleJsonLd({
            title: post.title, description: newMeta, slug: post.slug, coverImage: post.cover_image,
            category: post.category || 'general', tags: Array.isArray(post.tags) ? post.tags : [],
            publishedAt: (post as any).published_at, updatedAt: (post as any).updated_at,
            authorName: (post as any).author_name || '카더라',
          });
          const prevMeta = (post as any).metadata && typeof (post as any).metadata === 'object' ? (post as any).metadata : {};
          await sb.from('blog_posts').update({
            meta_description: newMeta,
            metadata: { ...(prevMeta as Record<string, any>), json_ld: jsonLd, seo_enriched_at: new Date().toISOString(), seo_enriched_by: 'backfill' },
          }).eq('id', post.id);
          await (sb as any).from('issue_alerts').update({ seo_enriched_at: new Date().toISOString() }).eq('id', issue.id);
          try { await (sb as any).rpc('advance_issue_stage', { p_issue_id: issue.id, p_stage: 'seo' }); } catch {}
          stats.seo_enriched++;
          issue.seo_enriched_at = new Date().toISOString();
        }
      }

      // === STAGE 4: publish ===
      if (issue.seo_enriched_at && !issue.is_published && issue.blog_post_id) {
        await (sb as any).from('issue_alerts').update({ publish_attempted_at: new Date().toISOString() }).eq('id', issue.id);
        const { data: gateRows } = await (sb as any).rpc('check_publish_gate', { p_post_id: Number(issue.blog_post_id) });
        const row = Array.isArray(gateRows) ? gateRows[0] : gateRows;
        const allowed = !!row?.allowed;
        if (allowed) {
          const nowIso = new Date().toISOString();
          const { error: pubErr } = await sb.from('blog_posts').update({ is_published: true, published_at: nowIso }).eq('id', Number(issue.blog_post_id));
          if (!pubErr) {
            await (sb as any).from('issue_alerts').update({
              is_published: true, published_at: nowIso, publish_decision: 'auto_published', block_reason: null,
            }).eq('id', issue.id);
            try { await (sb as any).rpc('advance_issue_stage', { p_issue_id: issue.id, p_stage: 'publish' }); } catch {}
            stats.published++;
          } else {
            failures.push(`${issue.id}:pub:${pubErr.message}`);
            stats.failed++;
          }
        } else {
          stats.gate_blocked++;
          await (sb as any).from('issue_alerts').update({
            publish_decision: 'gate_blocked',
            block_reason: (Array.isArray(row?.reasons) ? row.reasons : []).slice(0, 6).join(' | '),
          }).eq('id', issue.id);
        }
      }
    } catch (err: any) {
      stats.failed++;
      failures.push(`${issue.id}:exception:${err?.message || 'unknown'}`);
    }
  }

  return {
    processed: stats.processed,
    created: stats.published,
    updated: stats.fact_check_passed + stats.seo_enriched,
    failed: stats.failed,
    metadata: {
      ...stats,
      sample_failures: failures.slice(0, 8),
      elapsed_ms: Date.now() - start,
    },
  };
}

async function authGate(req: NextRequest): Promise<{ ok: boolean; via: 'cron' | 'admin'; error?: NextResponse }> {
  if (verifyCronAuth(req as any)) return { ok: true, via: 'cron' };
  const auth = await requireAdmin();
  if ('error' in auth) return { ok: false, via: 'admin', error: auth.error };
  return { ok: true, via: 'admin' };
}

async function handleRequest(req: NextRequest) {
  const gate = await authGate(req);
  if (!gate.ok) return gate.error!;
  return NextResponse.json(
    await withCronLogging('issue-alerts-backfill', () => runBackfill(), { redisLockTtlSec: 330 }),
  );
}

export const GET = handleRequest;
export const POST = handleRequest;
