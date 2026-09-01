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

    /* ─── s268(산식-가): 미발행 글 전용 채점 경로 (대상 한정) ───────────────────────
     *
     * 위 경로는 .eq('is_published', true) 라 미발행 글은 채점된 적이 없다. 그런데
     * auto_publish_eligible 은 seo_tier 를 요구하므로, 미발행 글은 티어가 갱신되지 않아
     * 영원히 후보에 들지 못한다.
     *
     * 산식 교정: view_count(25) 와 반응(10) 을 뺀다. 둘 다 «발행 이후에만 생기는 값» 이라
     * 발행 자격 판정에 넣는 것은 순환 참조다(발행돼야 조회가 생기고, 조회가 있어야 A 가 되고,
     * A 여야 발행된다). 만점 100 → 65 이고 문턱은 같은 비율로 낮춘다 — 문턱을 낮춘 것이
     * 아님을 산술로 보인다: S 70→46 · A 50→33 · B 30→20 · C 15→10.
     *
     * 대상 한정: 최근 이미지가 붙은 글만. 전면 적용하면 미발행 3만여 편이 한꺼번에
     * eligible 이 되어 시간당 50편씩 자동 발행된다(실측). 수문은 별건 정책으로 연다.
     */
    let unpubUpdated = 0;
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: recentImgs } = await (admin as any)
        .from('blog_post_images')
        .select('post_id')
        .gte('created_at', since)
        .limit(2000);
      const ids = Array.from(new Set((recentImgs || []).map((r: any) => r.post_id))).slice(0, 500);
      if (ids.length) {
        const { data: unpub } = await (admin as any)
          .from('blog_posts')
          .select('id, content, sub_category, source_ref, rewritten_at, title, seo_tier')
          .eq('is_published', false)
          .in('id', ids)
          .not('seo_tier', 'in', '(restore_candidate,restored,cooldown)');
        for (const p of (unpub || [])) {
          const contentLen = (p.content || '').length;
          const score =
            (contentLen >= 5000 ? 25 : contentLen >= 4000 ? 22 : contentLen >= 3000 ? 18 : contentLen >= 2000 ? 10 : 5) +
            (p.sub_category ? 15 : 0) +
            (p.source_ref ? 10 : 0) +
            (p.rewritten_at && contentLen >= 3000 ? 10 : p.rewritten_at ? 5 : 0) +
            (p.title && !p.title.includes('시세 분석') && !p.title.includes('투자 전망') ? 5 : 2);
          const tier = score >= 46 ? 'S' : score >= 33 ? 'A' : score >= 20 ? 'B' : score >= 10 ? 'C' : 'D';
          if (p.seo_tier !== tier) {
            await (admin as any).from('blog_posts')
              .update({ seo_score: score, seo_tier: tier, quality_checked_at: null })
              .eq('id', p.id);
            unpubUpdated++;
          }
        }
      }
    } catch (e: any) {
      console.error('[seo-score-refresh] unpublished pass failed:', e?.message);
    }

    return { processed: posts?.length || 0, updated, metadata: { total: posts?.length, unpublished_updated: unpubUpdated } };
  });

  return NextResponse.json(result);
}
