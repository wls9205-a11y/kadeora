/**
 * seo-score-refresh — 기발행 글의 seo_score·seo_tier 재계산 «전용».
 *
 * ⚠️ 이 라우트는 «의도적으로» 어디에도 등록돼 있지 않다(vercel.json · pg_cron 모두 없음).
 *    사문이 아니라 «대기» 다 — 지우지 말 것.
 *    등록 보류 사유: 채점 산식이 view_count 에 25점을 걸고 있는데 그 값이 합성이다
 *    (총합 745,303 대 30일 실조회 2,617). 오염된 값 위에서 기발행 2,000편을 다시 채점하면
 *    stale-unpublish 연쇄까지 함께 열린다.
 *    등록은 «view_count 정본화(합성 → 실측) 수리와 한 묶음» 으로만 의미가 있다 — 별건 대기열.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('seo-score-refresh', async () => {
    const admin = getSupabaseAdmin();

    // 배치 업데이트: 1000건씩 가져와서 score 계산 후 업데이트
    const { data: posts, error: fetchErr } = await (admin as any)
      .from('blog_posts')
      .select('id, content, view_count, helpful_count, comment_count, sub_category, source_ref, rewritten_at, title, seo_tier')
      .eq('is_published', true)
      .not('seo_tier', 'in', '(restore_candidate,restored,cooldown)')
      .limit(2000);

    if (fetchErr) {
      console.error('[seo-score-refresh] Fetch error:', fetchErr.message);
      return { processed: 0, error: fetchErr.message };
    }

    let updated = 0;
    for (const p of (posts || [])) {
      const contentLen = (p.content || '').length;
      const score =
        (contentLen >= 5000 ? 25 : contentLen >= 4000 ? 22 : contentLen >= 3000 ? 18 : contentLen >= 2000 ? 10 : 5) +
        (p.view_count >= 50 ? 25 : p.view_count >= 20 ? 20 : p.view_count >= 10 ? 15 : p.view_count >= 5 ? 10 : p.view_count >= 1 ? 5 : 0) +
        (p.sub_category ? 15 : 0) +
        (p.source_ref ? 10 : 0) +
        Math.min((p.helpful_count || 0) * 3 + (p.comment_count || 0) * 2, 10) +
        (p.rewritten_at && contentLen >= 3000 ? 10 : p.rewritten_at ? 5 : 0) +
        (p.title && !p.title.includes('시세 분석') && !p.title.includes('투자 전망') ? 5 : 2);

      const tier = score >= 70 ? 'S' : score >= 50 ? 'A' : score >= 30 ? 'B' : score >= 15 ? 'C' : 'D';

      if (p.seo_tier !== tier) {
        // r4-P10-2: 티어가 바뀌면 재평가 계기로 삼는다.
        // blog-quality-score 는 quality_checked_at 이 NULL 이거나 30일 경과한 글만 보므로,
        // 여기서 NULL 로 되돌리지 않으면 티어가 올라가도 auto_publish_eligible 이 false 로 남아
        // blog-auto-publish 가 후보 0건을 본다. (batch-rewrite-poll · blog-enrich-rewrite 와 같은 관용)
        await (admin as any).from('blog_posts')
          .update({ seo_score: score, seo_tier: tier, quality_checked_at: null })
          .eq('id', p.id);
        updated++;
      }
    }

    /* s268: 미발행 글 전용 채점 경로는 blog-quality-score(02:00) 로 옮겼다.
     * 그 크론은 이미 등록돼 있고 이미 미발행 글을 대상으로 돌므로, 여기에 두면 새 크론이
     * 하나 더 필요하거나 같은 산식이 두 곳에 남는다. */

    return { processed: posts?.length || 0, updated, metadata: { total: posts?.length } };
  });

  return NextResponse.json(result);
}
