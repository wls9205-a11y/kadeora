export const maxDuration = 60;
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

  const systemPrompt = `당신은 카더라(kadeora.app)의 전문 에디터입니다. 부동산/주식 분석 기사를 작성합니다.

규칙:
- 분량: 2,500~4,000자
- H2 섹션: 5~8개 (## 형식)
- FAQ: 최소 5개 (Q. A. 형식으로 본문 마지막에)
- 면책 조항 포함 (투자 판단은 본인 책임)
- 데이터 출처 명시
- 특정 종목/단지 매수·매도 권유 절대 금지
- "오를 것이다", "내릴 것이다" 등 단정적 전망 금지
- 원본 뉴스 문장을 그대로 사용하지 말고 팩트만 추출하여 새로운 문장으로 작성
- 숫자에는 ~ 대신 ～(물결표) 사용
- 카더라 내부 링크 1개 이상 포함 (/apt, /stock, /blog 등)

기사 유형: ${template}
카테고리: ${issue.category === 'apt' ? '부동산' : '주식'}`;

  const userPrompt = `다음 이슈에 대해 블로그 기사를 작성하세요.

제목: ${issue.title}
요약: ${issue.summary}
핵심 키워드: ${(issue.detected_keywords || []).join(', ')}
관련 대상: ${(issue.related_entities || []).join(', ')}
원본 데이터: ${JSON.stringify(issue.raw_data || {})}
출처 URL: ${(issue.source_urls || []).join(', ')}

응답 형식 (JSON):
{
  "title": "SEO 최적화된 기사 제목 (40~60자, | 구분자 사용)",
  "slug": "url-safe-slug-한글가능",
  "keywords": ["키워드1", "키워드2", ...],
  "content": "마크다운 본문 전체"
}

JSON만 응답하세요. 다른 텍스트 없이.`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
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

  // 3. FAQ 존재 체크
  if (!content.includes('Q.') && !content.includes('자주 묻는')) issues.push('FAQ누락');

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
  const buzzCount = score >= 55 ? 3 : score >= 45 ? 2 : 1;
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

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  // 킬스위치 체크
  const config = await getAutoPublishConfig(sb);

  // 미처리 이슈 1건 조회 (최고 점수 우선)
  const { data: issues } = await (sb as any).from('issue_alerts')
    .select('*')
    .eq('is_processed', false)
    .gte('final_score', 40)
    .order('final_score', { ascending: false })
    .limit(1);

  if (!issues || issues.length === 0) {
    return NextResponse.json({ processed: 0, message: 'no pending issues' });
  }

  const issue = issues[0];

  // v2: 즉시 is_processed=true 마킹 (동시 실행 race condition 방지)
  const { data: lockResult } = await (sb as any).from('issue_alerts')
    .update({ is_processed: true, processed_at: new Date().toISOString() })
    .eq('id', issue.id)
    .eq('is_processed', false) // CAS: 아직 미처리인 경우만
    .select('id');
  if (!lockResult || lockResult.length === 0) {
    return NextResponse.json({ processed: 0, message: 'already processing (race)' });
  }

  // v2: 기존 blog_posts에 같은 토픽 글 있으면 AI 생성 스킵
  const issueKeywords: string[] = issue.detected_keywords || [];
  const skipReasons: string[] = [];
  if (issueKeywords.length >= 1) {
    // 24시간 내 같은 키워드로 작성된 블로그 검색
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
        if (overlap.length >= 2) {
          skipReasons.push(`keyword_overlap:${blog.id}:${overlap.join(',')}`);
          break;
        }
      }
    }
    // pg_trgm으로 제목 유사도 체크
    if (skipReasons.length === 0) {
      try {
        const { data: simBlogs } = await sb.rpc('check_blog_similarity', {
          p_title: issue.title,
          p_threshold: 0.2,
        });
        if (simBlogs && simBlogs.length > 0) {
          skipReasons.push(`title_similar:${simBlogs[0].id}:${simBlogs[0].title?.slice(0, 30)}`);
        }
      } catch { /* RPC 없으면 스킵 */ }
    }
  }
  if (skipReasons.length > 0) {
    await (sb as any).from('issue_alerts').update({
      publish_decision: 'duplicate_blog',
      draft_content: skipReasons.join(' | '),
    }).eq('id', issue.id);
    return NextResponse.json({ processed: 0, message: 'duplicate_blog', reason: skipReasons[0] });
  }

  // AI 기사 생성
  const article = await generateArticle(issue);
  if (!article) {
    await (sb as any).from('issue_alerts').update({
      publish_decision: 'ai_failed',
    }).eq('id', issue.id);
    return NextResponse.json({ processed: 0, error: 'AI generation failed' });
  }

  // 팩트 검증
  const check = factCheck(article.content, issue.raw_data || {});

  // 자동 발행 판정
  const canAutoPublish = config.auto_publish_enabled
    && issue.final_score >= (config.auto_publish_min_score ?? 40)
    && !issue.block_reason
    && check.passed
    && !(config.auto_publish_blocked_categories || []).includes(issue.category);

  // safeBlogInsert로 발행
  // v2: 카테고리 매핑 + 커버 이미지 자동 설정
  const blogCategory = (['apt', 'stock', 'finance', 'general'] as const).includes(issue.category as any)
    ? issue.category : (issue.category === 'tax' ? 'finance' : issue.category === 'economy' ? 'finance' : 'general');
  const coverImage = `${SITE_URL}/api/og?title=${encodeURIComponent(article.title)}&category=${blogCategory}&author=${encodeURIComponent('카더라')}&design=2`;
  const imageAlt = `${article.title} — 카더라 분석`;

  const insertResult = await safeBlogInsert(sb, {
    slug: article.slug,
    title: article.title,
    content: article.content,
    category: blogCategory as any,
    tags: article.keywords,
    source_type: 'auto_issue',
    cron_type: 'issue-draft',
    source_ref: (issue.source_urls || [])[0],
    meta_description: (() => {
      const desc = (article as any).meta_description || (issue.summary || '').slice(0, 160);
      return desc.length >= 20 ? desc : `${desc} — ${article.title}`.slice(0, 160);
    })(),
    meta_keywords: article.keywords.join(','),
    cover_image: coverImage,
    image_alt: imageAlt,
    is_published: canAutoPublish,
  });

  // blog_post_id 확보 (safeBlogInsert가 id를 못 반환한 경우 slug으로 조회)
  let blogPostId = insertResult.id || null;
  if (!blogPostId && article.slug) {
    try {
      const { data: found } = await sb.from('blog_posts')
        .select('id').eq('slug', article.slug).maybeSingle();
      if (found) blogPostId = String(found.id);
    } catch {}
  }

  // issue_alerts 업데이트
  await (sb as any).from('issue_alerts').update({
    is_published: (canAutoPublish && (insertResult.success || !!blogPostId)),
    publish_decision: canAutoPublish && (insertResult.success || !!blogPostId) ? 'auto'
      : canAutoPublish ? 'auto_failed'
      : (insertResult.success || !!blogPostId) ? 'draft' : 'failed',
    blog_post_id: blogPostId,
    draft_title: article.title,
    draft_content: article.content,
    draft_slug: article.slug,
    draft_keywords: article.keywords,
    infographic_data: article.infographic_data || {},
    draft_template: selectDraftTemplate(issue.category, issue.issue_type),
    fact_check_passed: check.passed,
    fact_check_details: check.details,
    published_at: canAutoPublish && (insertResult.success || !!blogPostId) ? new Date().toISOString() : null,
  }).eq('id', issue.id);

  // 자동 발행 성공 시 후속 작업
  if (canAutoPublish && insertResult.success) {
    // 피드 공식 포스트
    await createOfficialFeedPost(sb, issue, article.slug);

    // 뻘글 스케줄링
    await scheduleBuzzPosts(sb, issue.id, issue.final_score);

    // IndexNow
    try {
      await submitIndexNow([`${SITE_URL}/blog/${article.slug}`]);
    } catch {}
  }

  return NextResponse.json({
    processed: 1,
    title: article.title,
    score: issue.final_score,
    decision: canAutoPublish ? 'auto_published' : insertResult.success ? 'draft_saved' : 'failed',
    fact_check: check.passed,
    slug: article.slug,
  });
}

export const GET = withCronAuth(handler);
