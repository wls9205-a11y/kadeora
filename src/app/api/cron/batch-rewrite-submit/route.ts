import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { diversifyPrompt, getRandomStructure, getRandomStyle } from '@/lib/blog-prompt-diversity';
import { getFreshnessContext } from '@/lib/blog/freshness-context';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_SIZE = 500;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('batch-rewrite-submit', async () => {
    const admin = getSupabaseAdmin();

    // Check if there's already a batch in progress
    const { data: active } = await (admin as any).from('rewrite_batches')
      .select('id')
      .in('status', ['submitted', 'processing'])
      .limit(1);
    if (active && active.length > 0) {
      return { processed: 0, metadata: { reason: 'batch_in_progress', active_id: active[0].id } };
    }

    // Priority: unrewritten B/A/S tier → apt re-rewrite
    const { data: posts } = await (admin as any).from('blog_posts')
      .select('id, title, content, category, slug, seo_score, seo_tier')
      .eq('is_published', true)
      .in('seo_tier', ['S', 'A', 'B'])
      .is('rewritten_at', null)
      .order('view_count', { ascending: false })
      .limit(BATCH_SIZE);

    if (!posts || posts.length === 0) {
      return { processed: 0, metadata: { reason: 'no_candidates' } };
    }

    // Filter: exclude well-rewritten posts (apt rewritten with 3000+ chars)
    const candidates = posts.filter((p: any) => {
      if (p.category === 'apt' && p.content && p.content.length >= 3000) return false; // already good
      return true;
    }).slice(0, BATCH_SIZE);

    if (candidates.length === 0) {
      return { processed: 0, metadata: { reason: 'all_good' } };
    }

    // Build batch requests
    const requests = candidates.map((post: any) => {
      const style = getRandomStyle();
      const structure = getRandomStructure();
      const stockGuidance = post.category === 'stock' ? `

[주식 카테고리 SEO 강화 요구사항]
- 글 본문 첫 단락에 종목 ticker (예: 005930, AAPL) + 회사명 + 섹터 명시
- meta_description 에 ticker + 회사명 포함
- 본문에 \`/stock/{ticker}\` 형식의 내부 링크 최소 2개 포함 (마크다운: [회사명](/stock/{ticker}))
- 종목 비교 시 \`/stock/{tickerA}/vs/{tickerB}\` 링크 권장
` : '';
      const prompt = diversifyPrompt(`한국 금융·부동산 전문 블로그 작가로서 아래 글을 리라이팅하세요.

스타일: ${style}
구조: ${structure}

핵심 규칙:
- 반드시 3500자 이상 작성
- 소제목(##) 3~8개, 각 섹션에 구체적 예시·수치·비교 포함
- 수치 데이터 유지 / 마크다운 형식

마크다운 포맷 규칙 (필수):
- "## 목차" 절대 생성하지 마세요
- ## 제목 안에 **볼드** 사용 금지
- 숫자 범위에 ~ 사용 금지 ("60%에서 70%" 형식 사용)
- 테이블 | 구분자 정확히 사용

내부링크 규칙:
- 카더라 내부 페이지 링크 5개 이상 자연스럽게 삽입
- 글 끝에 "### 🔗 관련 정보" 섹션 추가
${stockGuidance}
카테고리: ${post.category}

${getFreshnessContext()}

${post.content}`);

      return {
        custom_id: `blog-${post.id}`,
        params: {
          model: AI_MODEL_HAIKU,
          max_tokens: 5000,
          messages: [{ role: 'user', content: prompt }],
        },
      };
    });

    // Submit to Anthropic Batch API
    const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ requests }),
    });

    if (!batchRes.ok) {
      const err = await batchRes.text();
      return { processed: 0, metadata: { error: `Batch API error: ${batchRes.status}`, detail: err.slice(0, 200) } };
    }

    const batchData = await batchRes.json();
    const batchId = batchData.id;

    // Record batch in DB
    const postIds = candidates.map((p: any) => ({ id: p.id, slug: p.slug, category: p.category }));
    const inputTokensEst = candidates.length * 2500;
    const outputTokensEst = candidates.length * 3500;
    const costEst = (inputTokensEst * 0.5 + outputTokensEst * 2.5) / 1_000_000; // Batch API 50% off

    await (admin as any).from('rewrite_batches').insert({
      batch_id: batchId,
      status: 'submitted',
      category: candidates[0]?.category || 'mixed',
      post_ids: postIds,
      batch_size: candidates.length,
      cost_estimate: costEst,
    });

    return {
      processed: candidates.length,
      metadata: { batch_id: batchId, cost_estimate: `$${costEst.toFixed(2)}`, categories: [...new Set(candidates.map((p: any) => p.category))] },
    };
  });

  return NextResponse.json(result);
}
