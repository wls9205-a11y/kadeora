import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 점진적 비공개 전환 크론
 * 매일 실행, seo_tier B/C 글을 3,500편씩 비공개 처리
 * 7일에 걸쳐 ~52,000편 비공개 완료
 * 급격한 사이트맵 축소를 방지하기 위해 점진적 실행
 */
const DAILY_LIMIT = 3500;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-quality-prune', async () => {
    const admin = getSupabaseAdmin();

    // Check remaining count
    const { count: remaining } = await (admin as any).from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .in('seo_tier', ['B', 'C']);

    if (!remaining || remaining === 0) {
      return { processed: 0, metadata: { reason: 'prune_complete', remaining: 0 } };
    }

    // Get today's batch — lowest seo_score first (worst go first)
    const { data: toPrune } = await (admin as any).from('blog_posts')
      .select('id')
      .eq('is_published', true)
      .in('seo_tier', ['B', 'C'])
      .order('seo_score', { ascending: true })
      .limit(DAILY_LIMIT);

    if (!toPrune || toPrune.length === 0) {
      return { processed: 0, metadata: { reason: 'no_candidates' } };
    }

    const ids = toPrune.map((p: any) => p.id);

    // Unpublish in batch
    const { error } = await (admin as any).from('blog_posts')
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      return { processed: 0, metadata: { error: error.message } };
    }

    return {
      processed: ids.length,
      metadata: { remaining: (remaining || 0) - ids.length, daily_limit: DAILY_LIMIT },
    };
  });

  return NextResponse.json(result);
}
