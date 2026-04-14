import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { enrichAptData, enrichStockData, formatAptDataForPrompt, formatStockDataForPrompt, extractAptName, extractStockSymbol } from '@/lib/blog-data-enrichment';
import { checkBlogQuality, stripInlineHtml } from '@/lib/blog-quality-gate';
import { diversifyPrompt } from '@/lib/blog-prompt-diversity';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH = 3;

/**
 * C등급 블로그 실데이터 기반 재생성 크론
 * 기존 blog-rewrite와 다른 점: 원본 콘텐츠를 AI에 넘기는 대신 DB 실데이터를 주입
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-enrich-rewrite', async () => {
    const admin = getSupabaseAdmin();

    // C등급: 인라인 HTML 포함된 글 우선
    const { data: posts } = await admin.from('blog_posts')
      .select('id, title, slug, category, content')
      .eq('is_published', true)
      .like('content', '%style=%background:#0f172a%')
      .order('view_count', { ascending: false })
      .limit(BATCH);

    if (!posts || posts.length === 0) {
      return { processed: 0, metadata: { reason: 'no_c_grade_left' } };
    }

    let enriched = 0;
    const results: { slug: string; score: number; issues: string[] }[] = [];

    for (const post of posts) {
      try {
        let dataPrompt = '';
        let enrichmentFound = false;

        if (post.category === 'apt' || post.category === 'unsold') {
          const extracted = extractAptName(post.title);
          if (extracted) {
            const data = await enrichAptData(extracted.name, extracted.sigungu);
            if (data) {
              dataPrompt = formatAptDataForPrompt(data);
              enrichmentFound = true;
            }
          }
        } else if (post.category === 'stock') {
          const symbol = extractStockSymbol(post.title, post.slug);
          if (symbol) {
            const data = await enrichStockData(symbol);
            if (data) {
              dataPrompt = formatStockDataForPrompt(data);
              enrichmentFound = true;
            }
          }
        }

        // 실데이터 없으면 스킵 (원칙: 데이터 없으면 발행하지 않는다)
        if (!enrichmentFound) {
          // 인라인 HTML이라도 제거
          const cleaned = stripInlineHtml(post.content);
          if (cleaned !== post.content) {
            await (admin as any).from('blog_posts').update({
              content: cleaned,
              updated_at: new Date().toISOString(),
            }).eq('id', post.id);
          }
          results.push({ slug: post.slug, score: -1, issues: ['실데이터 없음 — HTML만 정리'] });
          continue;
        }

        const systemPrompt = `당신은 한국 부동산·금융 전문 데이터 애널리스트입니다.
아래 실데이터를 기반으로 "${post.title}"에 대한 심층 분석 글을 작성하세요.

${dataPrompt}

## 출력 규칙 (필수):
- 순수 마크다운만 출력 (인라인 HTML style 태그 절대 금지, <div style=...> 금지)
- 최소 5,000자 작성
- 소제목(##) 5~7개, 각 섹션에 구체적 수치와 비교 분석 포함
- 마크다운 표(|---|) 2개 이상
- "## 목차" 섹션 생성 금지
- ## 제목 안에 **볼드** 사용 금지
- FAQ 3~5개 (### ❓ 형식)
- 글 끝에 "### 🔗 관련 정보" 섹션 (내부 링크 5개+)
- 면책: "> 이 분석은 공공 데이터 기반이며 투자 조언이 아닙니다."
- 도입부: 매번 다른 방식으로 시작 (정형화 금지)
- 숫자 범위: ~ 대신 "에서" 사용 (예: "60%에서 70%")

카테고리: ${post.category}`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: AI_MODEL_HAIKU,
            max_tokens: 6000,
            messages: [{ role: 'user', content: diversifyPrompt(systemPrompt) }],
          }),
        });

        if (!res.ok) {
          if (res.status === 529 || res.status === 402) break;
          continue;
        }
        const data = await res.json();
        const newContent = data.content?.[0]?.text;
        if (!newContent || newContent.length < 3000) continue;

        // 품질 게이트
        const quality = checkBlogQuality(newContent, post.category);
        results.push({ slug: post.slug, score: quality.score, issues: quality.issues });

        if (!quality.pass) {
          console.warn(`[blog-enrich-rewrite] Quality gate failed: ${post.slug} (${quality.score}점)`, quality.issues);
          continue;
        }

        // meta_description 생성
        const clean = newContent.replace(/[#|*\n\r\-\[\]\(\)/]/g, ' ').replace(/\s+/g, ' ').trim();

        await (admin as any).from('blog_posts').update({
          content: newContent,
          meta_description: clean.slice(0, 120) + ' — 카더라',
          excerpt: clean.slice(0, 150),
          rewritten_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_length: newContent.length,
          quality_checked_at: null, // 품질 재평가 트리거
        }).eq('id', post.id);

        enriched++;
        console.info(`[blog-enrich-rewrite] ✅ ${post.slug} (${quality.score}점, ${quality.tier})`);
      } catch (err: any) {
        console.error(`[blog-enrich-rewrite] Error: ${post.slug}`, err.message);
      }
    }

    return { processed: enriched, metadata: { total: posts.length, results } };
  });

  return NextResponse.json(result);
}
