export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { submitIndexNow } from '@/lib/indexnow';
import { selectDraftTemplate } from '@/lib/issue-scoring';
import { SITE_URL } from '@/lib/constants';

/**
 * issue-draft v2 — AI 기사 생성 + 자동 발행 + 이미지 + 피드 포스트
 *
 * 세션 108 전면 수정:
 * - A1: og-infographic 제거 → 마크다운 하이라이트 블록
 * - A2: blog_posts.is_published 강제 UPDATE (비공개 버그 수정)
 * - A3: AI 에러 로깅 + retry_count 재시도 (최대 3회)
 * - A5: 네이버 이미지 검색 → 실사진 삽입
 * - B1: withCronLogging 적용
 * - B3: FAQ 필수 강화 + max_tokens 12000
 * - B4: MAX_PER_RUN 15, 스케줄 every 7min
 * - C2: seo_tier 기본 'A'
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

/* ═══════════ 킬스위치 체크 ═══════════ */

async function getAutoPublishConfig(sb: any) {
  try {
    const { data } = await sb.from('blog_publish_config')
      .select('auto_publish_enabled, auto_publish_min_score, auto_publish_blocked_categories')
      .eq('id', 1).single();
    return data || { auto_publish_enabled: true, auto_publish_min_score: 40, auto_publish_blocked_categories: [] };
  } catch {
    return { auto_publish_enabled: true, auto_publish_min_score: 40, auto_publish_blocked_categories: [] };
  }
}

/* ═══════════ 네이버 이미지 검색 ═══════════ */

async function searchNaverImages(query: string, count = 5): Promise<{ url: string; alt: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${count}&sort=sim&filter=large`, {
      headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[issue-draft] Naver Image API error: ${res.status} | query="${query}"`);
      return [];
    }
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      url: (item.link || '').replace('http://', 'https://'),
      alt: item.title?.replace(/<[^>]+>/g, '') || query,
    })).filter((img: any) => img.url && !img.url.includes('daumcdn') && !img.url.includes('tistory'));
  } catch (err: any) {
    console.error(`[issue-draft] Naver fetch error: ${err.message} | query="${query}"`);
    return [];
  }
}

/* ═══════════ AI 기사 생성 (v2: 에러 로깅 + og-infographic 제거) ═══════════ */

async function generateArticle(issue: any): Promise<{ title: string; content: string; slug: string; keywords: string[]; meta_description: string; infographic_data: Record<string, any> } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('[issue-draft] ANTHROPIC_API_KEY missing'); return null; }

  const template = selectDraftTemplate(issue.category, issue.issue_type);
  const isPreempt = ['pre_announcement', 'preempt_coverage', 'new_subscription', 'search_spike'].includes(issue.issue_type);
  const catKo = issue.category === 'apt' ? '부동산' : issue.category === 'stock' ? '주식' : '경제';

  const systemPrompt = `당신은 카더라(kadeora.app)의 수석 데이터 에디터입니다. ${isPreempt ? '분양 선점형 심층 분석' : catKo + ' 심층 분석'} 기사를 작성합니다.

규칙:
- 분량: ${isPreempt ? '6,000~8,000자' : '5,000~7,000자'} (충분히 깊이 있게)
- H2 섹션: 6~10개 (## 형식)
- 마크다운 표(|---|): 최소 2개 (비교 분석 필수)
- 핵심 수치 강조: **굵은 숫자**와 퍼센트를 적극 활용
- 각 섹션 첫 문장에 핵심 수치 배치
- 면책 조항 포함 (투자 판단은 본인 책임)
- 데이터 출처 명시
- 특정 종목/단지 매수·매도 권유 절대 금지
- "오를 것이다", "내릴 것이다" 등 단정적 전망 금지
- 원본 뉴스 문장 그대로 사용 금지 — 팩트만 추출하여 새 문장
- 카더라 내부 링크 3개 이상: [텍스트](/apt), [텍스트](/stock), [텍스트](/blog) 등
${isPreempt ? `
## 선점형 콘텐츠 특별 규칙:
- 예상 분양가, 예상 경쟁률, 입지 분석을 깊이 있게
- 주변 시세 비교 테이블 필수 (반경 1km 내 단지)
- 청약 전략 가이드 섹션 포함 (가점/추첨, 자금계획)
- "이 정보는 공식 발표 전 수집된 것으로 변동될 수 있습니다" 면책 포함
` : ''}
## 구조 가이드:
- 도입부: 핵심 팩트 1~2줄 → 배경 설명
- 본론: 데이터 테이블 + 분석 의견 교차
- 결론: 전망 시나리오 (긍정/부정/중립 3가지)

⚠️ FAQ는 **필수**입니다. 누락 시 기사가 발행되지 않습니다.
반드시 "## 자주 묻는 질문" 섹션을 포함하고, Q./A. 형식으로 5~8개 작성하세요.
구글/네이버 FAQPage 리치스니펫용이므로 형식을 정확히 지켜주세요.

기사 유형: ${template}
카테고리: ${catKo}`;

  const userPrompt = `다음 이슈에 대해 데이터 분석 블로그 기사를 작성하세요.

제목: ${issue.title}
요약: ${issue.summary}
핵심 키워드: ${(issue.detected_keywords || []).join(', ')}
관련 대상: ${(issue.related_entities || []).join(', ')}
원본 데이터: ${JSON.stringify(issue.raw_data || {}).slice(0, 2000)}
출처 URL: ${(issue.source_urls || []).join(', ')}

요구사항:
1. 비교 분석 마크다운 테이블 최소 2개
2. 3가지 시나리오 전망 (긍정/중립/부정)
3. "## 자주 묻는 질문" 섹션 + Q./A. 형식 5~8개 (필수!)
4. 관련 카더라 페이지 내부 링크 3개+ (마크다운 [텍스트](/경로) 형식)
5. 이미지 삽입 금지 — 이미지는 자동으로 추가됩니다

응답 형식 (JSON만, 다른 텍스트 없이):
{
  "title": "SEO 최적화 제목 (40~60자, | 구분자)",
  "slug": "url-safe-slug-한글가능",
  "keywords": ["키워드1", "키워드2", ...최소 5개],
  "meta_description": "검색 결과에 노출될 설명 (120~160자)",
  "content": "마크다운 본문 전체 (5000자 이상)"
}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 12000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[issue-draft] AI API ${res.status}: ${errBody.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    if (!text) { console.error('[issue-draft] AI returned empty text'); return null; }

    // JSON 파싱 (```json 제거)
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error(`[issue-draft] JSON parse failed for issue ${issue.id}: ${(parseErr as Error).message}`, clean.slice(0, 200));
      return null;
    }

    if (!parsed.title || !parsed.content) {
      console.error(`[issue-draft] Missing title/content for issue ${issue.id}`);
      return null;
    }

    return {
      title: parsed.title,
      content: parsed.content,
      slug: parsed.slug || parsed.title.replace(/[^가-힣a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase(),
      keywords: parsed.keywords || issue.detected_keywords || [],
      meta_description: parsed.meta_description || '',
      infographic_data: {},
    };
  } catch (e) {
    console.error('[issue-draft] AI generation exception:', (e as Error).message);
    return null;
  }
}

/* ═══════════ 콘텐츠 보강 (v2: og-infographic 제거 → 마크다운 하이라이트) ═══════════ */

function enrichVisuals(content: string, issue: any): string {
  let enriched = content;
  const keywords = (issue.detected_keywords || []).slice(0, 5);
  const entities = (issue.related_entities || []).join(', ') || (issue.title || '').slice(0, 20);
  const category = issue.category || 'general';

  // 1. 깨진 og-infographic 참조 전부 제거
  enriched = enriched.replace(/!\[[^\]]*\]\([^)]*og-infographic[^)]*\)\n?/g, '');

  // 2. 도입부에 핵심 요약 하이라이트 블록 (인포그래픽 대체)
  if (!enriched.includes('> **📊') && !enriched.includes('> **🏠') && !enriched.includes('> **📈')) {
    const icon = category === 'apt' ? '🏠' : category === 'stock' ? '📈' : '💡';
    const summaryBlock = `\n> **${icon} 핵심 요약** | ${keywords.slice(0, 3).join(' · ') || entities}\n> ${issue.summary ? issue.summary.slice(0, 120) : '이 기사의 핵심 포인트를 확인하세요.'}\n\n`;

    const firstH2 = enriched.indexOf('\n## ');
    if (firstH2 > 0) {
      enriched = enriched.slice(0, firstH2) + '\n' + summaryBlock + enriched.slice(firstH2);
    }
  }

  // 3. 테이블이 없으면 → 핵심 지표 요약 테이블 자동 삽입
  if (!enriched.includes('|---')) {
    const catLabel: Record<string, string> = { apt: '부동산', stock: '주식/금융', finance: '재테크', economy: '경제' };
    const summaryTable = `\n\n| 항목 | 내용 |\n|---|---|\n| 대상 | ${entities} |\n| 카테고리 | ${catLabel[category] || '분석'} |\n| 핵심 키워드 | ${keywords.join(', ') || '분석, 전망'} |\n| 분석 시점 | ${new Date().toISOString().slice(0, 10)} |\n| 출처 | 카더라 데이터 분석 |\n\n`;
    const firstH2End = enriched.indexOf('\n', enriched.indexOf('\n## ') + 4);
    if (firstH2End > 0) {
      enriched = enriched.slice(0, firstH2End + 1) + summaryTable + enriched.slice(firstH2End + 1);
    } else {
      enriched += summaryTable;
    }
  }

  // 4. 카더라 내부링크 부족하면 → 하단에 추가
  const internalLinkCount = (enriched.match(/\]\(\//g) || []).length;
  if (internalLinkCount < 2) {
    const linkBlocks: Record<string, string> = {
      apt: `\n\n---\n\n## 관련 정보\n\n- [카더라 청약 일정 →](/apt)\n- [전국 실거래가 조회 →](/apt?tab=transaction)\n- [청약 가점 계산기 →](/apt/diagnose)\n- [카더라 블로그 →](/blog?category=apt)\n\n`,
      stock: `\n\n---\n\n## 관련 정보\n\n- [실시간 주식 시세 →](/stock)\n- [종목 비교 분석 →](/stock/compare)\n- [카더라 블로그 →](/blog?category=stock)\n- [투자 커뮤니티 →](/feed)\n\n`,
    };
    enriched += linkBlocks[category] || linkBlocks.stock || linkBlocks.apt;
  }

  return enriched;
}

/* ═══════════ 이미지 삽입 (본문 H2 사이에 실사진) ═══════════ */

async function insertImages(content: string, title: string, keywords: string[], category: string, blogPostId: number | null, sb: any): Promise<string> {
  const query = keywords.slice(0, 2).join(' ') || title.replace(/[[\]|()]/g, '').slice(0, 20);
  const searchQuery = category === 'apt' ? `${query} 아파트 단지` : category === 'stock' ? `${query} 주식 차트` : `${query} 경제`;
  const images = await searchNaverImages(searchQuery, 5);
  if (images.length === 0) return content;

  let enriched = content;
  const h2Matches = [...enriched.matchAll(/^## .+$/gm)];

  // H2 2개마다 이미지 1장 삽입 (최대 3장)
  let inserted = 0;
  for (let i = 2; i < h2Matches.length && inserted < 3 && inserted < images.length; i += 2) {
    const match = h2Matches[i];
    if (match.index !== undefined) {
      const img = images[inserted];
      const imgBlock = `\n\n![${img.alt}](${img.url})\n\n`;
      enriched = enriched.slice(0, match.index) + imgBlock + enriched.slice(match.index);
      // 이후 매치 인덱스가 밀리므로 offset 조정
      for (let j = i + 1; j < h2Matches.length; j++) {
        if (h2Matches[j].index !== undefined) {
          (h2Matches[j] as any).index += imgBlock.length;
        }
      }
      inserted++;
    }
  }

  // blog_post_images DB에 저장
  if (blogPostId && images.length > 0) {
    const imageInserts = images.slice(0, inserted + 1).map((img, i) => ({
      post_id: blogPostId,
      image_url: img.url,
      alt_text: img.alt,
      image_type: 'stock_photo',
      position: i,
    }));
    try { await (sb as any).from('blog_post_images').insert(imageInserts); } catch {}
  }

  // 커버 이미지 교체 (position 0)
  if (blogPostId && images.length > 0) {
    try {
      await sb.from('blog_posts').update({
        cover_image: images[0].url,
        image_alt: images[0].alt,
      }).eq('id', blogPostId);
    } catch {}
  }

  return enriched;
}

/* ═══════════ 팩트 검증 ═══════════ */

function factCheck(content: string, rawData: Record<string, any>): { passed: boolean; details: Record<string, any> } {
  const issues: string[] = [];
  const banned = ['매수 추천', '매도 추천', '반드시 오를', '반드시 내릴', '급등 예상', '급락 예상',
    '목표가', '적정가', '저점 매수', '물타기', '꼭 사야', '꼭 팔아야'];
  for (const word of banned) {
    if (content.includes(word)) issues.push(`금지표현: ${word}`);
  }
  if (content.length < 1500) issues.push('분량부족');
  if (!content.includes('Q.') && !content.includes('자주 묻는') && !content.includes('❓') && !content.includes('FAQ')) issues.push('FAQ누락');
  return { passed: issues.length === 0, details: { issues, content_length: content.length } };
}

/* ═══════════ 피드 포스트 생성 ═══════════ */

async function createOfficialFeedPost(sb: any, issue: any, blogSlug: string) {
  const { data: systemUser } = await sb.from('profiles').select('id').eq('nickname', '카더라').limit(1).maybeSingle();
  if (!systemUser) return;
  const prefixMap: Record<string, string> = { apt: '🏠', stock: '📊', finance: '💰', tax: '📋', economy: '🌐', life: '🏃' };
  const prefix = prefixMap[issue.category] || '📰';
  const entities = (issue.related_entities || []).join(', ');
  const title = issue.title.length > 50 ? issue.title.slice(0, 50) + '...' : issue.title;
  const content = `${prefix} [속보] ${title}\n\n${issue.summary || ''}\n\n상세 분석 👉 ${SITE_URL}/blog/${blogSlug}`;
  await sb.from('posts').insert({
    author_id: systemUser.id, title: `[속보] ${entities || '이슈'} 분석`,
    content: content.slice(0, 500),
    category: issue.category === 'apt' ? 'realestate' : issue.category === 'stock' ? 'stock' : 'finance',
    is_anonymous: false, created_at: new Date().toISOString(),
  });
}

/* ═══════════ 뻘글 스케줄링 ═══════════ */

async function scheduleBuzzPosts(sb: any, issueId: string, score: number) {
  const personas = ['curious', 'self_deprecating', 'question', 'calculator', 'sharer', 'realist'];
  const selected = personas.sort(() => Math.random() - 0.5).slice(0, 1);
  const now = Date.now();
  await (sb as any).from('scheduled_feed_posts').insert(selected.map((persona, i) => ({
    issue_id: issueId, persona_type: persona,
    scheduled_at: new Date(now + (8 + i * 10) * 60 * 1000).toISOString(), is_published: false,
  })));
}

/* ═══════════ 메인: 이슈 1건 처리 ═══════════ */

async function processOneIssue(sb: any, issue: any, config: any): Promise<{ decision: string; title?: string; score: number; slug?: string }> {
  // CAS lock
  const retryCount = issue.retry_count || 0;
  const { data: lockResult } = await (sb as any).from('issue_alerts')
    .update({ is_processed: true, processed_at: new Date().toISOString(), retry_count: retryCount })
    .eq('id', issue.id).eq('is_processed', false).select('id');
  if (!lockResult || lockResult.length === 0) return { decision: 'race', score: issue.final_score };

  // 중복 체크
  const issueKeywords: string[] = issue.detected_keywords || [];
  const skipReasons: string[] = [];
  if (issueKeywords.length >= 1) {
    const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: recentBlogs } = await sb.from('blog_posts')
      .select('id, title, tags, cron_type').eq('is_published', true)
      .eq('category', issue.category === 'economy' ? 'finance' : issue.category)
      .gte('created_at', since24h).limit(50);
    if (recentBlogs) {
      const GENERIC = new Set(['청약','분양','아파트','부동산','투자','시세','분석','전망','부산','서울','경기','인천','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주','수도권','지방','매매','전세','월세','실거래','재개발','재건축','미분양','stock','apt','finance']);
      for (const blog of recentBlogs) {
        const blogTags: string[] = blog.tags || [];
        const overlap = issueKeywords.filter((k: string) => !GENERIC.has(k) && (blogTags.includes(k) || (blog.title || '').includes(k)));
        if (overlap.length >= 3) { skipReasons.push(`keyword_overlap:${blog.id}:${overlap.join(',')}`); break; }
      }
    }
    if (skipReasons.length === 0) {
      try {
        const { data: simBlogs } = await sb.rpc('check_blog_similarity', { p_title: issue.title, p_threshold: 0.35 });
        if (simBlogs && simBlogs.length > 0) skipReasons.push(`title_similar:${simBlogs[0].id}:${simBlogs[0].title?.slice(0, 30)}`);
      } catch {}
    }
  }
  if (skipReasons.length > 0) {
    await (sb as any).from('issue_alerts').update({ publish_decision: 'duplicate_blog', block_reason: skipReasons.join(' | '), is_processed: true }).eq('id', issue.id);
    return { decision: 'duplicate', score: issue.final_score };
  }

  // AI 기사 생성
  const article = await generateArticle(issue);
  if (!article) {
    // A3: 재시도 로직 — retry_count < 3이면 is_processed=false로 리셋
    const newRetry = retryCount + 1;
    if (newRetry < 3) {
      await (sb as any).from('issue_alerts').update({ is_processed: false, publish_decision: null, retry_count: newRetry }).eq('id', issue.id);
      return { decision: `ai_failed_retry_${newRetry}`, score: issue.final_score };
    }
    await (sb as any).from('issue_alerts').update({ publish_decision: 'ai_failed', retry_count: newRetry }).eq('id', issue.id);
    return { decision: 'ai_failed_final', score: issue.final_score };
  }

  article.content = enrichVisuals(article.content, issue);
  const check = factCheck(article.content, issue.raw_data || {});

  const canAutoPublish = config.auto_publish_enabled
    && issue.final_score >= (config.auto_publish_min_score ?? 40)
    && !issue.block_reason && check.passed
    && !(config.auto_publish_blocked_categories || []).includes(issue.category);

  const blogCategory = (['apt', 'stock', 'finance', 'general'] as const).includes(issue.category as any)
    ? issue.category : (issue.category === 'tax' || issue.category === 'economy' ? 'finance' : 'general');
  const designBase: Record<string, number[]> = { apt: [1,2,4,6], stock: [2,3,5,6], finance: [1,3,4,5], general: [1,2,3,4] };
  const designs = designBase[blogCategory] || designBase.general;
  const titleHash = article.title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const design = designs[titleHash % designs.length];
  const coverImage = `${SITE_URL}/api/og?title=${encodeURIComponent(article.title)}&category=${blogCategory}&author=${encodeURIComponent('카더라')}&design=${design}`;

  const insertResult = await safeBlogInsert(sb, {
    slug: article.slug, title: article.title, content: article.content,
    category: blogCategory as any, tags: article.keywords,
    source_type: 'auto_issue', cron_type: 'issue-draft',
    source_ref: (issue.source_urls || [])[0],
    meta_description: (() => { const desc = (article as any).meta_description || (issue.summary || '').slice(0, 160); return desc.length >= 20 ? desc : `${desc} — ${article.title}`.slice(0, 160); })(),
    meta_keywords: article.keywords.join(','),
    cover_image: coverImage, image_alt: `${article.title} — 카더라 분석`,
    is_published: canAutoPublish,
  });

  let blogPostId: number | null = (insertResult.id ? Number(insertResult.id) : null);
  if (!blogPostId && article.slug) {
    try { const { data: found } = await sb.from('blog_posts').select('id').eq('slug', article.slug).maybeSingle(); if (found) blogPostId = found.id; } catch {}
  }

  // A2: 발행 결정인데 blog_posts.is_published=false인 경우 강제 공개
  if (canAutoPublish && blogPostId) {
    try {
      await sb.from('blog_posts').update({
        is_published: true,
        published_at: new Date().toISOString(),
        seo_tier: 'A', // C2: 이슈 선점 콘텐츠 기본 A등급
      }).eq('id', blogPostId).eq('is_published', false);
    } catch {}
  }

  // A5: 이미지 삽입 (네이버 검색 → 본문 + 커버 교체)
  if (blogPostId) {
    try {
      const enrichedWithImages = await insertImages(article.content, article.title, article.keywords, blogCategory, blogPostId, sb);
      if (enrichedWithImages !== article.content) {
        await sb.from('blog_posts').update({ content: enrichedWithImages }).eq('id', blogPostId);
      }
    } catch (imgErr) {
      console.warn('[issue-draft] image insert failed:', (imgErr as Error).message);
    }
  }

  const insertFailed = !insertResult.success && !blogPostId;
  await (sb as any).from('issue_alerts').update({
    is_published: (canAutoPublish && !!blogPostId),
    publish_decision: canAutoPublish && !!blogPostId ? 'auto' : canAutoPublish ? 'auto_failed' : !!blogPostId ? 'draft' : 'failed',
    block_reason: insertFailed ? (insertResult.message || insertResult.reason || 'safeBlogInsert failed') : null,
    blog_post_id: blogPostId, draft_title: article.title, draft_content: article.content,
    draft_slug: article.slug, draft_keywords: article.keywords,
    infographic_data: {},
    draft_template: selectDraftTemplate(issue.category, issue.issue_type),
    fact_check_passed: check.passed, fact_check_details: check.details,
    published_at: canAutoPublish && !!blogPostId ? new Date().toISOString() : null,
  }).eq('id', issue.id);

  if (canAutoPublish && blogPostId) {
    await createOfficialFeedPost(sb, issue, article.slug);
    await scheduleBuzzPosts(sb, issue.id, issue.final_score);
    try { await submitIndexNow([`${SITE_URL}/blog/${article.slug}`]); } catch {}
  }

  return { decision: canAutoPublish ? 'auto_published' : !!blogPostId ? 'draft_saved' : 'failed', title: article.title, score: issue.final_score, slug: article.slug };
}

/* ═══════════ 핸들러 ═══════════ */

async function handler(_req: NextRequest) {
  const result = await withCronLogging('issue-draft', async () => {
    const sb = getSupabaseAdmin();
    const config = await getAutoPublishConfig(sb);
    const _start = Date.now();
    const MAX_PER_RUN = 15;

    // 25점 미만 자동 스킵 (큐 정리)
    await (sb as any).from('issue_alerts')
      .update({ is_processed: true, publish_decision: 'below_threshold', processed_at: new Date().toISOString() })
      .eq('is_processed', false).lt('final_score', 25);

    // 미처리 이슈 조회 (최고 점수 우선 + ai_failed 재시도 포함)
    const { data: issues } = await (sb as any).from('issue_alerts')
      .select('*')
      .eq('is_processed', false)
      .gte('final_score', 25)
      .order('final_score', { ascending: false })
      .limit(MAX_PER_RUN);

    if (!issues || issues.length === 0) {
      return { processed: 0, created: 0, failed: 0, metadata: { message: 'no pending issues' } };
    }

    const results: any[] = [];
    let published = 0;
    for (const issue of issues) {
      if (Date.now() - _start > 250_000) break;
      try {
        const r = await processOneIssue(sb, issue, config);
        results.push(r);
        if (r.decision === 'auto_published') published++;
      } catch (e) {
        console.error(`[issue-draft] error processing ${issue.id}:`, e);
        results.push({ decision: 'error', score: issue.final_score });
      }
    }

    return {
      processed: results.length,
      created: published,
      failed: results.filter(r => r.decision.includes('failed')).length,
      metadata: {
        published,
        results: results.map(r => ({ decision: r.decision, score: r.score, title: r.title?.slice(0, 40) })),
      },
    };
  });
  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
