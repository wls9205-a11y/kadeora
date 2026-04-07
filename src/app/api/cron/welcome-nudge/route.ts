import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 30;

/**
 * welcome-nudge 크론 — 가입 후 D+1, D+3 맞춤 알림
 * D+1: 관심 지역 기반 추천 + 첫 미션 안내
 * D+3: 미활동 시 인기 콘텐츠 추천
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('welcome-nudge', async () => {
    const sb = getSupabaseAdmin();
    let sent = 0;

    // D+1 유저 (가입 24~48시간)
    const d1Start = new Date(Date.now() - 48 * 3600000).toISOString();
    const d1End = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: d1Users } = await sb.from('profiles')
      .select('id, nickname, region_text')
      .gte('created_at', d1Start).lte('created_at', d1End)
      .neq('is_seed', true).neq('is_ghost', true);

    for (const u of d1Users || []) {
      const { count } = await sb.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.id).eq('type', 'system')
        .like('content', '%첫 미션%');
      if ((count ?? 0) > 0) continue;

      const region = u.region_text || '전국';
      await sb.from('notifications').insert({
        user_id: u.id, type: 'system',
        content: `${u.nickname || '회원'}님, ${region} 지역 청약 소식과 인기 종목 분석이 기다리고 있어요! 첫 미션을 완료하고 300P를 받아가세요 🎁`,
        is_read: false, link: '/feed',
      });
      sent++;
    }

    // D+3 유저 (가입 72~96시간, 활동 0건)
    const d3Start = new Date(Date.now() - 96 * 3600000).toISOString();
    const d3End = new Date(Date.now() - 72 * 3600000).toISOString();
    const { data: d3Users } = await sb.from('profiles')
      .select('id, nickname')
      .gte('created_at', d3Start).lte('created_at', d3End)
      .neq('is_seed', true).neq('is_ghost', true)
      .eq('posts_count', 0);

    for (const u of d3Users || []) {
      const { count } = await sb.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.id).eq('type', 'system')
        .like('content', '%인기 글%');
      if ((count ?? 0) > 0) continue;

      const { data: hotPost } = await sb.from('posts')
        .select('id, title, slug')
        .order('likes_count', { ascending: false })
        .limit(1).single();

      const postTitle = hotPost?.title?.slice(0, 30) || '투자 분석';
      await sb.from('notifications').insert({
        user_id: u.id, type: 'system',
        content: `${u.nickname || '회원'}님, 카더라에서 가장 인기 있는 글: "${postTitle}" 📰 지금 확인해보세요!`,
        is_read: false, link: hotPost?.slug ? `/feed/${hotPost.slug}` : '/feed',
      });
      sent++;
    }

    return { processed: (d1Users?.length || 0) + (d3Users?.length || 0), created: sent, failed: 0 };
  });

  return NextResponse.json({ ok: true, ...result });
}
