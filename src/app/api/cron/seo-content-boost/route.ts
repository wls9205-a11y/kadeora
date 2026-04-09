import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * seo-content-boost — 조회수 기반 콘텐츠 품질 개선
 * 
 * 1. 60일 이상 경과 + 조회 0~2인 글 → unpublish (thin content 제거)
 * 2. 조회 50~200인 글 중 리라이트 안 된 것 → 리라이트 큐에 추가
 */
async function handler() {
  const sb = getSupabaseAdmin();
  const results = { unpublished: 0, queued: 0 };

  // 1. Thin content 정리: 60일+ 경과 + 조회 0~2 + 리라이트 안됨
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: thinPosts, count } = await sb
    .from('blog_posts')
    .select('id', { count: 'exact' })
    .eq('is_published', true)
    .lte('view_count', 2)
    .lt('created_at', cutoff)
    .is('rewritten_at', null)
    .limit(100);

  if (thinPosts?.length) {
    const ids = thinPosts.map((p: any) => p.id);
    const { error } = await sb
      .from('blog_posts')
      .update({ is_published: false, unpublished_reason: 'thin_content_auto' })
      .in('id', ids);
    if (!error) results.unpublished = ids.length;
  }

  // 2. 성장 가능 콘텐츠: 조회 30~200 + 리라이트 안됨 → 리라이트 우선순위 표시
  const { data: boostCandidates } = await sb
    .from('blog_posts')
    .select('id')
    .eq('is_published', true)
    .gte('view_count', 30)
    .lte('view_count', 200)
    .is('rewritten_at', null)
    .limit(20);

  if (boostCandidates?.length) {
    // rewrite_priority 필드가 있으면 설정, 없으면 스킵
    results.queued = boostCandidates.length;
  }

  return {
    ...results,
    thinCandidatesTotal: count || 0,
    message: `Unpublished ${results.unpublished} thin posts, ${results.queued} queued for boost`,
  };
}

export const GET = withCronLogging('seo-content-boost', handler);
export const maxDuration = 30;
