import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

/**
 * weekly-digest 크론 — 매주 월요일 9시 실행
 * 
 * 마케팅 동의한 유저에게 지난주 요약 이메일 발송
 * - 인기 게시글 TOP 3
 * - 청약 마감 임박 현장
 * - 주식 주간 등락 요약
 * - 신규 블로그 추천
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('weekly-digest', async () => {
    const sb = getSupabaseAdmin();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // 마케팅 동의 유저 조회
    const { data: subscribers } = await sb.from('notification_settings')
      .select('user_id, profiles!inner(email, nickname)')
      .eq('marketing_agreed', true);

    if (!subscribers?.length) return { processed: 0, created: 0, failed: 0, reason: 'no_subscribers' };

    // 지난주 인기 게시글 TOP 3
    const { data: hotPosts } = await sb.from('posts')
      .select('title, slug, likes_count, comments_count')
      .gte('created_at', weekAgo)
      .order('likes_count', { ascending: false })
      .limit(3);

    // 이번주 마감 청약
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const { data: deadlines } = await sb.from('apt_subscriptions')
      .select('house_manage_no, house_nm, rcept_endde')
      .gte('rcept_endde', today).lte('rcept_endde', nextWeek)
      .order('rcept_endde').limit(5);

    // 신규 블로그 TOP 3
    const { data: newBlogs } = await sb.from('blog_posts')
      .select('title, slug, category, excerpt')
      .eq('is_published', true)
      .gte('published_at', weekAgo)
      .order('views', { ascending: false })
      .limit(3);

    // 이메일 발송 (DB에 기록만 — 실제 이메일은 추후 SendGrid/Resend 연동)
    let sent = 0;
    for (const sub of subscribers) {
      const profile = (sub as any).profiles;
      if (!profile?.email) continue;

      // 알림으로 기록 (이메일 발송 대신 — 이메일 서비스 연동 전까지)
      await sb.from('notifications').insert({
        user_id: sub.user_id,
        type: 'system',
        content: `📊 주간 리포트가 준비됐어요! ${hotPosts?.length || 0}개 인기글, ${deadlines?.length || 0}개 청약 마감 임박`,
        is_read: false,
        link: '/feed',
      });
      sent++;
    }

    return {
      processed: subscribers.length,
      created: sent,
      failed: 0,
      hotPosts: hotPosts?.length || 0,
      deadlines: deadlines?.length || 0,
      newBlogs: newBlogs?.length || 0,
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
