export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { submitIndexNow } from '@/lib/indexnow';
import { selectDraftTemplate } from '@/lib/issue-scoring';
import { SITE_URL } from '@/lib/constants';

/**
 * issue-draft 크론 — AI 기사 생성 + 자동 발행 + 피드 포스트
 *
 * 미처리 이슈 1건씩 처리 (안정성)
 * score 40+ AND 킬스위치 ON → 자동 발행
 * score 25~39 → draft 저장
 * 주기: 매 20분
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

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

/* ═══════════ AI 기사 생성 ═══════════ */

async function generateArticle(issue: any): Promise<{ title: string; content: string; slug: string; keywords: string[]; meta_description: string; infographic_data: Record<string, any> } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const template = selectDraftTemplate(issue.category, issue.issue_type);

  const isPreempt = ['pre_announcement', 'preempt_coverage', 'new_subscription', 'search_spike'].includes(issue.issue_type);

  const systemPrompt = `당신은 카더라(kadeora.app)의 수석 데이터 에디터입니다. ${isPreempt ? '분양 선점형 심층 분석' : '부동산/주식 심층 분석'} 기사를 작성합니다.

규칙:
- 분량: ${isPreempt ? '6,000~8,000자' : '5,000~7,000자'} (충분히 깊이 있게)
- H2 섹션: 6~10개 (## 형식)
- 마크다운 표(|---|): 최소 2개 (비교 분석 필수)
- FAQ: 5~8개 (반드시 "Q. 질문" + "A. 답변" 형식 — 구글/네이버 FAQPage 리치스니펫용)
- 면책 조항 포함 (투자 판단은 본인 책임)
- 데이터 출처 명시
- 특정 종목/단지 매수·매도 권유 절대 금지
- "오를 것이다", "내릴 것이다" 등 단정적 전망 금지
- 원본 뉴스 문장을 그대로 사용하지 말고 팩트만 추출하여 새로운 문장으로 작성
- 카더라 내부 링크 3개 이상 (/apt, /stock, /blog, /calc 등)
${isPreempt ? `
## 선점형 콘텐츠 특별 규칙:
- "~카더라" 식 전해듣기 정보와 확인된 팩트를 명확히 구분
- 예상 분양가, 예상 경쟁률, 입지 분석을 깊이 있게
- 주변 시세 비교 테이블 필수 (반경 1km 내 단지)
- 청약 전략 가이드 섹션 포함 (가점/추첨, 자금계획)
- "이 정보는 공식 발표 전 수집된 것으로 변동될 수 있습니다" 면책 포함
- 제목에 "[선점분석]" 또는 "분양 전 알아야 할 모든 것" 스타일
` : ''}
## 시각 요소 (필수):
1. 본문 첫 문단 아래에 인포그래픽 이미지 삽입:
   ![제목](/api/og-infographic?title=핵심+요약&category=${issue.category === 'apt' ? 'apt' : 'stock'}&type=summary&items=핵심항목1,핵심항목2,핵심항목3)
   → items는 쉼표 구분, 5개 이내

2. 핵심 데이터 비교 섹션에 비교 인포그래픽:
   ![비교](/api/og-infographic?title=비교+분석&category=${issue.category === 'apt' ? 'apt' : 'stock'}&type=comparison&items=항목1:값1,항목2:값2,항목3:값3)
   → items는 "라벨:값" 형식

3. 핵심 수치 강조:
   - **굵은 숫자**와 퍼센트를 적극 활용
   - 각 섹션 첫 문장에 핵심 수치 배치

## 구조 가이드:
- 도입부: 핵심 팩트 1~2줄 → 인포그래픽 → 배경 설명
- 본론: 데이터 테이블 + 분석 의견 교차
- 결론: 전망 시나리오 (긍정/부정/중립 3가지)
- FAQ: 실제 투자자가 궁금해할 질문

기사 유형: ${template}
카테고리: ${issue.category === 'apt' ? '부동산' : '주식'}`;

  const userPrompt = `다음 이슈에 대해 데이터 분석 블로그 기사를 작성하세요.

제목: ${issue.title}
요약: ${issue.summary}
핵심 키워드: ${(issue.detected_keywords || []).join(', ')}
관련 대상: ${(issue.related_entities || []).join(', ')}
원본 데이터: ${JSON.stringify(issue.raw_data || {})}
출처 URL: ${(issue.source_urls || []).join(', ')}

요구사항:
1. 도입부에 핵심 수치를 한눈에 보여주는 인포그래픽 이미지 삽입
2. 비교 분석 테이블 최소 2개
3. 3가지 시나리오 전망 (긍정/중립/부정)
4. FAQ 5~8개 (반드시 "Q. 질문" 다음줄 "A. 답변" 형식)
5. 관련 카더라 페이지 내부 링크 3개+

응답 형식 (JSON만, 다른 텍스트 없이):
{
  "title": "SEO 최적화 제목 (40~60자, | 구분자)",
  "slug": "url-safe-slug-한글가능",
  "keywords": ["키워드1", "키워드2", ...],
  "meta_description": "검색 결과에 노출될 설명 (120~160자)",
  "content": "마크다운 본문 전체 (5000자 이상, 인포그래픽 이미지 포함)"
}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 8192, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // JSON 파싱 (```json 제거)
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (!parsed.title || !parsed.content) return null;

    return {
      title: parsed.title,
      content: parsed.content,
      slug: parsed.slug || parsed.title.replace(/[^가-힣a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase(),
      keywords: parsed.keywords || issue.detected_keywords || [],
      meta_description: parsed.meta_description || '',
      infographic_data: parsed.infographic_data || {},
    };
  } catch (e) {
    console.error('[issue-draft] AI generation failed:', e);
    return null;
  }
}

/* ═══════════ 시각 요소 강제 보강 ═══════════ */

function enrichVisuals(content: string, issue: any): string {
  let enriched = content;
  // 인포그래픽 유효 카테고리: stock, apt, finance, tax, economy, life
  const validCats = ['stock', 'apt', 'finance', 'tax', 'economy', 'life'];
  const category = validCats.includes(issue.category) ? issue.category : (issue.category === 'apt' ? 'apt' : 'stock');
  const title = issue.title || '';
  const keywords = (issue.detected_keywords || []).slice(0, 5);
  const entities = (issue.related_entities || []).join(', ') || title.slice(0, 20);

  // 1. 인포그래픽 이미지가 없으면 → 첫 h2 앞에 요약 인포그래픽 자동 삽입
  if (!content.includes('og-infographic') && !content.includes('![')) {
    const summaryItems = keywords.length >= 3
      ? keywords.slice(0, 4).join(',')
      : `${entities},핵심분석,시장전망,투자포인트`;
    const infographic = `\n![핵심 요약](/api/og-infographic?title=${encodeURIComponent(entities + ' 핵심 요약')}&category=${category}&type=summary&items=${encodeURIComponent(summaryItems)})\n`;

    // 첫 번째 ## 앞에 삽입
    const firstH2 = enriched.indexOf('\n## ');
    if (firstH2 > 0) {
      enriched = enriched.slice(0, firstH2) + '\n' + infographic + enriched.slice(firstH2);
    } else {
      // h2가 없으면 첫 문단 뒤에 삽입
      const firstParagraphEnd = enriched.indexOf('\n\n');
      if (firstParagraphEnd > 0) {
        enriched = enriched.slice(0, firstParagraphEnd) + '\n' + infographic + enriched.slice(firstParagraphEnd);
      }
    }
  }

  // 2. 인포그래픽이 1개뿐이면 → 본문 중간에 비교 인포그래픽 추가
  const infographicCount = (enriched.match(/og-infographic/g) || []).length;
  if (infographicCount < 2) {
    const compareItems: Record<string, string> = {
      apt: '현재시세:분석중,전월대비:변동,경쟁률:예상,투자매력:평가',
      stock: '현재주가:분석중,PER:비교,업종평균:대비,전망:종합',
      finance: '금리:비교,수익률:분석,리스크:평가,추천:종합',
      economy: '지표:분석,전월대비:변동,전망:종합,영향:평가',
      tax: '세율:비교,절세:방법,신고:일정,변경:사항',
      life: '비용:비교,혜택:분석,신청:방법,대상:확인',
    };
    const compareInfographic = `\n![비교 분석](/api/og-infographic?title=${encodeURIComponent('비교 분석')}&category=${category}&type=comparison&items=${encodeURIComponent(compareItems[category] || compareItems.stock)})\n`;

    // 전체의 60% 지점에 삽입
    const insertPos = Math.floor(enriched.length * 0.6);
    const nearestNewline = enriched.indexOf('\n\n', insertPos);
    if (nearestNewline > 0) {
      enriched = enriched.slice(0, nearestNewline) + '\n' + compareInfographic + enriched.slice(nearestNewline);
    }
  }

  // 3. 테이블이 없으면 → 핵심 지표 요약 테이블 자동 삽입
  if (!enriched.includes('|---')) {
    const catLabel: Record<string, string> = {
      apt: '부동산', stock: '주식/금융', finance: '재테크', economy: '경제', tax: '세금', life: '생활경제',
    };
    const summaryTable = `\n\n| 항목 | 내용 |\n|---|---|\n| 대상 | ${entities} |\n| 카테고리 | ${catLabel[category] || '분석'} |\n| 핵심 키워드 | ${keywords.join(', ') || '분석, 전망'} |\n| 분석 시점 | ${new Date().toISOString().slice(0, 10)} |\n| 출처 | 카더라 데이터 분석 |\n\n`;

    // 첫 h2 뒤에 삽입
    const firstH2End = enriched.indexOf('\n', enriched.indexOf('\n## ') + 4);
    if (firstH2End > 0) {
      enriched = enriched.slice(0, firstH2End + 1) + summaryTable + enriched.slice(firstH2End + 1);
    } else {
      enriched = enriched + summaryTable;
    }
  }

  // 4. 카더라 내부링크가 부족하면 → 하단에 관련 링크 블록 추가
  const internalLinkCount = (enriched.match(/\]\(\//g) || []).length;
  if (internalLinkCount < 2) {
    const linkBlocks: Record<string, string> = {
      apt: `\n\n---\n\n## 관련 정보\n\n- [카더라 청약 일정 →](/apt)\n- [전국 실거래가 조회 →](/apt?tab=transaction)\n- [청약 가점 계산기 →](/apt/diagnose)\n- [카더라 블로그 →](/blog?category=apt)\n\n`,
      stock: `\n\n---\n\n## 관련 정보\n\n- [실시간 주식 시세 →](/stock)\n- [종목 비교 분석 →](/stock/compare)\n- [카더라 블로그 →](/blog?category=stock)\n- [투자 커뮤니티 →](/feed)\n\n`,
      finance: `\n\n---\n\n## 관련 정보\n\n- [카더라 재테크 블로그 →](/blog?category=finance)\n- [실시간 주식 시세 →](/stock)\n- [부동산 정보 →](/apt)\n- [투자 커뮤니티 →](/feed)\n\n`,
      economy: `\n\n---\n\n## 관련 정보\n\n- [카더라 경제 블로그 →](/blog?category=finance)\n- [실시간 시세 →](/stock)\n- [부동산 시장 →](/apt)\n- [투자 커뮤니티 →](/feed)\n\n`,
      tax: `\n\n---\n\n## 관련 정보\n\n- [카더라 세금 가이드 →](/blog?category=finance)\n- [부동산 정보 →](/apt)\n- [투자 커뮤니티 →](/feed)\n\n`,
      life: `\n\n---\n\n## 관련 정보\n\n- [카더라 생활경제 →](/blog?category=finance)\n- [투자 커뮤니티 →](/feed)\n- [부동산 정보 →](/apt)\n\n`,
    };
    enriched = enriched + (linkBlocks[category] || linkBlocks.stock);
  }

  return enriched;
}

/* ═══════════ 팩트 검증 ═══════════ */

function factCheck(content: string, rawData: Record<string, any>): { passed: boolean; details: Record<string, any> } {
  const issues: string[] = [];

  // 1. 금지 표현 체크
  const banned = ['매수 추천', '매도 추천', '반드시 오를', '반드시 내릴', '급등 예상', '급락 예상',
    '목표가', '적정가', '저점 매수', '물타기', '꼭 사야', '꼭 팔아야'];
  for (const word of banned) {
    if (content.includes(word)) issues.push(`금지표현: ${word}`);
  }

  // 2. 최소 분량 체크
  if (content.length < 1500) issues.push('분량부족');

  // 3. FAQ 존재 체크 (Q./A., ❓, 자주 묻는 질문 형식 모두 인식)
  if (!content.includes('Q.') && !content.includes('자주 묻는') && !content.includes('❓') && !content.includes('FAQ')) issues.push('FAQ누락');

  return {
    passed: issues.length === 0,
    details: { issues, content_length: content.length },
  };
}

/* ═══════════ 피드 포스트 생성 ═══════════ */

async function createOfficialFeedPost(sb: any, issue: any, blogSlug: string) {
  // 시드 유저 중 시스템 계정 찾기
  const { data: systemUser } = await sb.from('profiles')
    .select('id')
    .eq('nickname', '카더라')
    .limit(1)
    .maybeSingle();

  if (!systemUser) return;

  const prefixMap: Record<string, string> = { apt: '🏠', stock: '📊', finance: '💰', tax: '📋', economy: '🌐', life: '🏃' };
  const prefix = prefixMap[issue.category] || '📰';
  const entities = (issue.related_entities || []).join(', ');
  const title = issue.title.length > 50 ? issue.title.slice(0, 50) + '...' : issue.title;

  const content = `${prefix} [속보] ${title}\n\n${issue.summary || ''}\n\n상세 분석 👉 ${SITE_URL}/blog/${blogSlug}`;

  await sb.from('posts').insert({
    author_id: systemUser.id,
    title: `[속보] ${entities || '이슈'} 분석`,
    content: content.slice(0, 500),
    category: issue.category === 'apt' ? 'realestate' : issue.category === 'stock' ? 'stock' : 'finance',
    is_anonymous: false,
    created_at: new Date().toISOString(),
  });
}

/* ═══════════ 뻘글 스케줄링 ═══════════ */

async function scheduleBuzzPosts(sb: any, issueId: string, score: number) {
  const buzzCount = 1; // v4: 이슈당 뻘글 1개로 제한 (도배 방지 강화)
  const personas = ['curious', 'self_deprecating', 'question', 'calculator', 'sharer', 'realist'];
  const selected = personas.sort(() => Math.random() - 0.5).slice(0, buzzCount);

  const now = Date.now();
  const inserts = selected.map((persona, i) => ({
    issue_id: issueId,
    persona_type: persona,
    scheduled_at: new Date(now + (8 + i * 10) * 60 * 1000).toISOString(), // 8분, 18분, 28분 후
    is_published: false,
  }));

  await (sb as any).from('scheduled_feed_posts').insert(inserts);
}

/* ═══════════ 메인 핸들러 ═══════════ */

async function processOneIssue(sb: any, issue: any, config: any): Promise<{ decision: string; title?: string; score: number; slug?: string }> {
  // CAS lock
  const { data: lockResult } = await (sb as any).from('issue_alerts')
    .update({ is_processed: true, processed_at: new Date().toISOString() })
    .eq('id', issue.id)
    .eq('is_processed', false)
    .select('id');
  if (!lockResult || lockResult.length === 0) return { decision: 'race', score: issue.final_score };

  // 중복 체크
  const issueKeywords: string[] = issue.detected_keywords || [];
  const skipReasons: string[] = [];
  if (issueKeywords.length >= 1) {
    const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: recentBlogs } = await sb.from('blog_posts')
      .select('id, title, tags, cron_type')
      .eq('is_published', true)
      .eq('category', issue.category === 'economy' ? 'finance' : issue.category)
      .gte('created_at', since24h)
      .limit(50);
    if (recentBlogs) {
      for (const blog of recentBlogs) {
        const blogTags: string[] = blog.tags || [];
        const overlap = issueKeywords.filter((k: string) => blogTags.includes(k) || (blog.title || '').includes(k));
        if (overlap.length >= 2) { skipReasons.push(`keyword_overlap:${blog.id}:${overlap.join(',')}`); break; }
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
    await (sb as any).from('issue_alerts').update({ publish_decision: 'ai_failed' }).eq('id', issue.id);
    return { decision: 'ai_failed', score: issue.final_score };
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

  const insertFailed = !insertResult.success && !blogPostId;
  await (sb as any).from('issue_alerts').update({
    is_published: (canAutoPublish && (insertResult.success || !!blogPostId)),
    publish_decision: canAutoPublish && (insertResult.success || !!blogPostId) ? 'auto' : canAutoPublish ? 'auto_failed' : (insertResult.success || !!blogPostId) ? 'draft' : 'failed',
    block_reason: insertFailed ? (insertResult.message || insertResult.reason || 'safeBlogInsert failed') : null,
    blog_post_id: blogPostId, draft_title: article.title, draft_content: article.content,
    draft_slug: article.slug, draft_keywords: article.keywords,
    infographic_data: article.infographic_data || {},
    draft_template: selectDraftTemplate(issue.category, issue.issue_type),
    fact_check_passed: check.passed, fact_check_details: check.details,
    published_at: canAutoPublish && (insertResult.success || !!blogPostId) ? new Date().toISOString() : null,
  }).eq('id', issue.id);

  if (canAutoPublish && insertResult.success) {
    await createOfficialFeedPost(sb, issue, article.slug);
    await scheduleBuzzPosts(sb, issue.id, issue.final_score);
    try { await submitIndexNow([`${SITE_URL}/blog/${article.slug}`]); } catch {}
  }

  return { decision: canAutoPublish ? 'auto_published' : insertResult.success ? 'draft_saved' : 'failed', title: article.title, score: issue.final_score, slug: article.slug };
}

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();
  const config = await getAutoPublishConfig(sb);
  const _start = Date.now();
  const MAX_PER_RUN = 4;

  // 25점 미만 자동 스킵 (큐 정리)
  await (sb as any).from('issue_alerts')
    .update({ is_processed: true, publish_decision: 'below_threshold', processed_at: new Date().toISOString() })
    .eq('is_processed', false).lt('final_score', 25);

  // 미처리 이슈 최대 4건 조회 (최고 점수 우선)
  const { data: issues } = await (sb as any).from('issue_alerts')
    .select('*')
    .eq('is_processed', false)
    .gte('final_score', 25)
    .order('final_score', { ascending: false })
    .limit(MAX_PER_RUN);

  if (!issues || issues.length === 0) {
    return NextResponse.json({ processed: 0, message: 'no pending issues' });
  }

  const results: any[] = [];
  for (const issue of issues) {
    if (Date.now() - _start > 100_000) break; // 100s 안전 마진
    try {
      const r = await processOneIssue(sb, issue, config);
      results.push(r);
    } catch (e) {
      console.error(`[issue-draft] error processing ${issue.id}:`, e);
      results.push({ decision: 'error', score: issue.final_score });
    }
  }

  return NextResponse.json({
    processed: results.length,
    published: results.filter(r => r.decision === 'auto_published').length,
    results: results.map(r => ({ decision: r.decision, score: r.score, title: r.title?.slice(0, 40) })),
  });
}

export const GET = withCronAuth(handler);
