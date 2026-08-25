import { NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL, AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { extractAptSiteSlugs } from '@/lib/blog-safe-insert';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 네이버 블로그 콘텐츠 자동 생성 크론
 * 
 * - kadeora.app 블로그 인기글 중 미발행분을 네이버 블로그 최적화 HTML로 변환
 * - 네이버 SEO 최적화: 제목 25자 이내, 키워드 3-5회, 이미지 6-13개, 본문 600-800자
 * - 어드민에서 "복사" 버튼 → 네이버 블로그에 붙여넣기
 * - 하루 3건 생성 (크론 1회당 3건)
 */

const BATCH_SIZE = 3;

/** 기존 pending 행에 현장 링크를 덧붙일 때의 1회 상한. AI 호출이 없어 가볍다. */
const BACKFILL_CAP = 40;

/**
 * ADDENDUM §2-7 — 네이버 → 카더라 **현장** 링크.
 *
 * 실측(2026-08-25): 신디케이션 93건 전부 kadeora.app 링크는 있는데
 * `/apt/` 현장 링크는 **0건**이었다. 하단 CTA 가 전부 /blog/{slug} 로만 가서
 * 네이버에서 온 사람이 현장 페이지(=리드폼이 있는 곳)에 닿지 못했다.
 * `오티에르 해운대` 가 네이버 블로그 1위인데 그 트래픽이 리드로 이어지지 않던 이유다.
 *
 * blog_posts.hub_apt_slug 가 이미 3,245편에 붙어 있으므로 그 값을 쓴다.
 * 본문에 다른 현장 링크가 더 있으면 그것도 함께 싣는다(최대 5곳).
 */
const NAVER_UTM = 'utm_source=naver_blog&utm_medium=syndication';

/** 네이버 본문에서 현장 링크 블록. 이미 있으면 다시 붙이지 않는다. */
const SITE_BLOCK_MARK = 'data-kd-sites="1"';

/** 글 → 현장 슬러그. hub_apt_slug 우선, 본문 링크로 보강. */
function siteSlugsForPost(post: any): string[] {
  const out: string[] = [];
  if (typeof post.hub_apt_slug === 'string' && post.hub_apt_slug) out.push(post.hub_apt_slug);
  for (const s of extractAptSiteSlugs(String(post.content ?? ''))) {
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, 5);
}

/** 현장 링크 블록 HTML. 이름은 DB 에서 가져온 실제 이름을 쓴다 — 슬러그를 노출하지 않는다. */
function siteLinkBlock(sites: { slug: string; name: string }[]): string {
  if (sites.length === 0) return '';
  const items = sites
    .map(
      (s) =>
        `<li><a href="${SITE_URL}/apt/${encodeURIComponent(s.slug)}?${NAVER_UTM}" target="_blank" rel="noopener">${s.name}</a> — 분양가·일정·잔여세대 확인</li>`,
    )
    .join('\n');
  return (
    `\n<p><br /></p>\n<div ${SITE_BLOCK_MARK}>\n` +
    `<p>🏠 <strong>이 글에서 다룬 현장</strong></p>\n<ul>\n${items}\n</ul>\n</div>`
  );
}

async function doWork() {
  const sb = getSupabaseAdmin();

  // 이미 발행된 slug 목록
  const { data: existing } = await (sb as any).from('naver_syndication').select('blog_slug');
  const existingSlugs = new Set((existing || []).map((e: any) => e.blog_slug));

  // 조회수 상위 블로그 포스트 중 미발행분
  // database.ts 가 hub_apt_slug 를 아직 모른다 (저장소 as any 관례).
  const { data: posts } = await (sb as any).from('blog_posts')
    // §2-7: hub_apt_slug 를 함께 읽는다 — 현장 링크의 1순위다.
    .select('id, slug, title, content, excerpt, category, tags, cover_image, image_alt, author_name, published_at, view_count, meta_description, hub_apt_slug')
    .eq('is_published', true)
    .not('published_at', 'is', null)
    .order('view_count', { ascending: false })
    .limit(100);

  const candidates = (posts || []).filter((p: any) => !existingSlugs.has(p.slug));
  const batch = candidates.slice(0, BATCH_SIZE);

  if (batch.length === 0) {
    return { processed: 0, metadata: { message: 'No new posts to syndicate' } };
  }

  let success = 0;
  const errors: string[] = [];

  for (const post of batch) {
    try {
      const naverContent = await generateNaverContent(post);

      // §2-7: 현장 링크 블록을 붙인다. hub_apt_slug + 본문 링크로 최대 5곳.
      const slugs = siteSlugsForPost(post);
      if (slugs.length > 0) {
        const { data: sites } = await (sb as any)
          .from('apt_sites').select('slug, name, display_name')
          .eq('is_active', true).in('slug', slugs);
        const named = (sites ?? []).map((s: any) => ({ slug: s.slug, name: s.display_name || s.name }));
        // 본문 등장 순서를 유지한다 — 첫 번째가 그 글의 주된 현장이다.
        named.sort((a: any, b: any) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
        if (named.length > 0) naverContent.html += siteLinkBlock(named);
      }

      await (sb as any).from('naver_syndication').insert({
        blog_post_id: post.id,
        blog_slug: post.slug,
        original_title: post.title,
        naver_title: naverContent.title,
        naver_html: naverContent.html,
        naver_tags: naverContent.tags,
        category: post.category,
        target: 'both',
        blog_status: 'pending',
        cafe_status: 'pending',
      });

      success++;
    } catch (e: any) {
      errors.push(`${post.slug}: ${e.message}`);
    }
  }

  const backfilled = await backfillSiteLinks(sb);

  return { processed: success, metadata: { errors, total: batch.length, ...backfilled } };
}

/**
 * §2-7 — 이미 만들어져 pending 으로 대기 중인 행에 현장 링크를 덧붙인다.
 *
 * 실측 87건이 4개월째 pending 인데 전부 `/apt/` 링크가 없다. 새로 만드는 것만 고치면
 * 그 87건은 링크 없는 채로 발행된다. AI 를 다시 부르지 않고 블록만 덧댄다.
 *
 * ⚠️ 이미 붙은 행은 건드리지 않는다(SITE_BLOCK_MARK 로 판정). 여러 번 돌아도 중복되지 않는다.
 * ⚠️ published 는 손대지 않는다 — 네이버에 이미 올라간 글과 DB 가 어긋나면 안 된다.
 */
async function backfillSiteLinks(sb: any) {
  const { data: rows } = await sb
    .from('naver_syndication')
    .select('id, blog_slug, naver_html')
    .eq('blog_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(BACKFILL_CAP);

  let scanned = 0;
  let updated = 0;
  let noSite = 0;

  for (const r of rows ?? []) {
    scanned++;
    const html = String(r.naver_html ?? '');
    if (html.includes(SITE_BLOCK_MARK) || /\/apt\/[^"'\s]/.test(html)) continue;

    const { data: post } = await sb
      .from('blog_posts').select('content, hub_apt_slug').eq('slug', r.blog_slug).maybeSingle();
    if (!post) continue;

    const slugs = siteSlugsForPost(post);
    if (slugs.length === 0) { noSite++; continue; }

    const { data: sites } = await sb
      .from('apt_sites').select('slug, name, display_name')
      .eq('is_active', true).in('slug', slugs);
    const named = (sites ?? []).map((s: any) => ({ slug: s.slug, name: s.display_name || s.name }));
    if (named.length === 0) { noSite++; continue; }
    named.sort((a: any, b: any) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));

    // ⚠️ 영향 행 수를 확인한다. 삼키면 "붙였다" 는 거짓 카운터가 된다.
    const { data: upd } = await sb
      .from('naver_syndication')
      .update({ naver_html: html + siteLinkBlock(named) })
      .eq('id', r.id)
      .select('id');
    if ((upd?.length ?? 0) > 0) updated++;
  }

  return { backfill_scanned: scanned, backfill_updated: updated, backfill_no_site: noSite };
}

async function generateNaverContent(post: any): Promise<{ title: string; html: string; tags: string[] }> {
  const SITE = SITE_URL;
  const catLabel: Record<string, string> = { stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크', general: '생활' };
  const category = catLabel[post.category] || '정보';
  
  // 본문에서 마크다운 제거
  const plainContent = (post.content || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_|`~>\[\]]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3000);

  const ogImage = post.cover_image?.startsWith('http') 
    ? post.cover_image 
    : `${SITE}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 50))}&design=${1 + Math.floor(Math.random() * 6)}&category=${post.category}`;

  // AI로 네이버 블로그 최적화 변환
  const prompt = `다음 블로그 글을 네이버 블로그에 최적화된 HTML로 변환하세요.

## 원본 글
제목: ${post.title}
카테고리: ${category}
본문:
${plainContent}

## 네이버 블로그 최적화 규칙 (반드시 준수)
1. 제목: 25자 이내, 핵심 키워드를 맨 앞에 배치
2. 본문 구조: H2 소제목 4-6개로 구분, 각 섹션 150-200자
3. 키워드: 제목의 핵심 키워드를 본문에 3-5회 자연스럽게 반복
4. 이미지 위치: 각 H2 섹션 사이에 이미지 플레이스홀더 [IMAGE] 삽입 (총 6-8개)
5. 마지막에 "📌 더 자세한 정보는 카더라(kadeora.app)에서 확인하세요" 문구 + 링크 포함
6. 해시태그: 관련 태그 5-8개 추출

## 출력 형식 (JSON)
{
  "title": "네이버 최적화 제목 (25자 이내)",
  "html": "네이버 블로그용 HTML (이미지 플레이스홀더 포함)",
  "tags": ["태그1", "태그2", ...]
}

JSON만 출력하세요. 다른 텍스트 없이.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: AI_MODEL_HAIKU,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // 이미지 플레이스홀더를 실제 OG 이미지로 교체
    let html = parsed.html || '';
    const ogSquare = `${SITE}/api/og-square?title=${encodeURIComponent((post.title || '').slice(0, 40))}&category=${post.category}`;
    const images = [ogImage, ogSquare];
    let imgIdx = 0;
    html = html.replace(/\[IMAGE\]/g, () => {
      const img = images[imgIdx % images.length];
      imgIdx++;
      return `<p style="text-align:center"><img src="${img}" alt="${post.image_alt || post.title}" style="max-width:100%;border-radius:8px" /></p>`;
    });

    // 하단 CTA 링크 보강
    if (!html.includes('kadeora.app')) {
      html += `\n<p><br /></p>\n<p>📌 <strong>더 자세한 분석은 <a href="${SITE}/blog/${post.slug}?utm_source=naver_blog&utm_medium=syndication" target="_blank" rel="noopener">카더라(kadeora.app)</a>에서 확인하세요!</strong></p>`;
    }

    return {
      title: (parsed.title || post.title).slice(0, 25),
      html,
      tags: parsed.tags || (post.tags || []).slice(0, 8),
    };
  } catch {
    // AI 실패 시 기본 변환
    const fallbackHtml = `
<h2>${post.title}</h2>
<p style="text-align:center"><img src="${ogImage}" alt="${post.image_alt || post.title}" style="max-width:100%;border-radius:8px" /></p>
<p>${(post.excerpt || post.meta_description || '').slice(0, 300)}</p>
<p><br /></p>
<p>📌 <strong>전문은 <a href="${SITE}/blog/${post.slug}?utm_source=naver_blog&utm_medium=syndication" target="_blank" rel="noopener">카더라(kadeora.app)</a>에서 확인하세요!</strong></p>`;

    return {
      title: (post.title || '').slice(0, 25),
      html: fallbackHtml,
      tags: (post.tags || []).slice(0, 8),
    };
  }
}

export const GET = withCronAuth(async () => {
  const result = await withCronLogging('naver-blog-content', doWork);
  return NextResponse.json(result);
});
