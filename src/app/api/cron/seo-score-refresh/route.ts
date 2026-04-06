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
        await (admin as any).from('blog_posts').update({ seo_score: score, seo_tier: tier }).eq('id', p.id);
        updated++;
      }
    }

    return { processed: posts?.length || 0, updated, metadata: { total: posts?.length } };
  });

  return NextResponse.json(result);
}
