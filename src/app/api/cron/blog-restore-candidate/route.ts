import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 비공개 글 복원 후보 자동 선별 크론 (주 1회)
 * 비공개 풀에서 가치 있는 글을 찾아 seo_tier='restore_candidate'로 마킹
 * batch-rewrite-submit이 이 글을 리라이트 후 재게시
 * 하루 최대 20편 속도 제한 (자연스러운 성장 패턴)
 */
const WEEKLY_RESTORE_LIMIT = 20;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-restore-candidate', async () => {
    const admin = getSupabaseAdmin();

    // Find unpublished posts whose related topics are trending
    // Strategy: find source_refs that match published posts with recent views
    const { data: trendingRefs } = await (admin as any).from('blog_posts')
      .select('source_ref')
      .eq('is_published', true)
      .not('source_ref', 'is', null)
      .gte('view_count', 10)
      .limit(100);

    const refs = (trendingRefs || []).map((r: any) => r.source_ref).filter(Boolean);

    // Find unpublished candidates matching trending refs
    let candidates: any[] = [];
    if (refs.length > 0) {
      const { data } = await (admin as any).from('blog_posts')
        .select('id, slug, category, seo_score, source_ref')
        .eq('is_published', false)
        .neq('seo_tier', 'restore_candidate') // not already marked
        .in('source_ref', refs.slice(0, 50))
        .order('seo_score', { ascending: false })
        .limit(WEEKLY_RESTORE_LIMIT);
      candidates = data || [];
    }

    // Also pick some high-score unpublished posts regardless of trending
    if (candidates.length < WEEKLY_RESTORE_LIMIT) {
      const remaining = WEEKLY_RESTORE_LIMIT - candidates.length;
      const existingIds = candidates.map(c => c.id);
      const { data: highScore } = await (admin as any).from('blog_posts')
        .select('id, slug, category, seo_score')
        .eq('is_published', false)
        .neq('seo_tier', 'restore_candidate')
        .not('id', 'in', `(${existingIds.length > 0 ? existingIds.join(',') : '0'})`)
        .gte('seo_score', 35)
        .order('seo_score', { ascending: false })
        .limit(remaining);
      candidates = [...candidates, ...(highScore || [])];
    }

    if (candidates.length === 0) {
      return { processed: 0, metadata: { reason: 'no_restore_candidates' } };
    }

    // Mark as restore candidates
    const ids = candidates.map(c => c.id);
    await (admin as any).from('blog_posts')
      .update({ seo_tier: 'restore_candidate' })
      .in('id', ids);

    return {
      processed: candidates.length,
      metadata: { trending_refs: refs.length, candidates: candidates.map(c => c.slug).slice(0, 5) },
    };
  });

  return NextResponse.json(result);
}
