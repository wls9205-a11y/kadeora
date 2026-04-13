import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;

/**
 * email-digest — 매주 월요일 09:00 KST (0 0 * * 1)
 * 
 * 대상: marketing_agreed = true 실유저
 * 발송: Resend (100통/일, 3,000통/월 무료)
 * 로그: email_send_logs 테이블 기록
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('email-digest', async () => {
    const sb = getSupabaseAdmin();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // 오늘 잔여 한도 체크
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await (sb as any)
      .from('email_send_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', todayStart.toISOString());
    const remaining = 100 - (sentToday || 0);
    if (remaining <= 0) return { processed: 0, metadata: { reason: 'daily_limit_reached', sentToday } };

    // 마케팅 동의 실유저
    const { data: users } = await sb.from('profiles')
      .select('id, nickname')
      .eq('marketing_agreed', true)
      .neq('is_seed', true).neq('is_deleted', true);

    if (!users?.length) return { processed: 0, metadata: { reason: 'no_marketing_users' } };

    // 이미 이번 주 digest 보낸 유저 제외
    const { data: alreadySent } = await (sb as any).from('email_send_logs')
      .select('recipient_email')
      .eq('campaign', 'weekly-digest')
      .eq('status', 'sent')
      .gte('created_at', weekAgo);
    const sentEmails = new Set((alreadySent || []).map((r: any) => r.recipient_email));

    // 주간 데이터 수집
    const [hotPosts, deadlines, newBlogs] = await Promise.all([
      sb.from('posts').select('title, slug, likes_count')
        .gte('created_at', weekAgo).order('likes_count', { ascending: false }).limit(3),
      (sb as any).from('apt_subscriptions').select('house_nm, rcept_endde')
        .gte('rcept_endde', new Date().toISOString().slice(0, 10))
        .lte('rcept_endde', new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
        .order('rcept_endde').limit(5),
      sb.from('blog_posts').select('title, slug, category')
        .eq('is_published', true).gte('published_at', weekAgo)
        .order('view_count', { ascending: false }).limit(3),
    ]);

    // 인앱 알림 (모든 유저)
    const notifs = users.map(u => ({
      user_id: u.id, type: 'system',
      content: `📊 주간 리포트! 인기글 ${hotPosts.data?.length || 0}개, 청약 마감 ${deadlines.data?.length || 0}건`,
      link: '/blog', is_read: false,
    }));
    await (sb as any).from('notifications').insert(notifs);

    // 이메일 발송 (Resend + 한도 고려)
    let emailSent = 0, emailFailed = 0;
    try {
      const { sendNotificationEmail } = await import('@/lib/email-sender');
      const { weeklyDigestBody } = await import('@/lib/email-templates');

      const body = weeklyDigestBody({
        hotPosts: (hotPosts.data || []) as any[],
        deadlines: (deadlines.data || []) as any[],
        newBlogs: (newBlogs.data || []) as any[],
      });

      const maxSend = Math.min(users.length, remaining, 80);

      // 배치 발송 (10명씩, 1초 딜레이)
      for (let i = 0; i < maxSend; i += 10) {
        const batch = users.slice(i, i + 10);
        await Promise.all(batch.map(async (u) => {
          try {
            const { data: authUser } = await sb.auth.admin.getUserById(u.id);
            const email = authUser?.user?.email;
            if (!email || sentEmails.has(email)) return;

            const subject = `${u.nickname || '회원'}님의 주간 투자 리포트 📊`;
            const r = await sendNotificationEmail(email, subject, body);

            await (sb as any).from('email_send_logs').insert({
              campaign: 'weekly-digest',
              recipient_email: email,
              user_id: u.id,
              status: r.ok ? 'sent' : 'failed',
              resend_id: r.ok ? r.id || null : null,
            }).catch(() => {});

            if (r.ok) emailSent++; else emailFailed++;
          } catch { emailFailed++; }
        }));
        if (i + 10 < maxSend) await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) { console.error('[email-digest]', e); }

    return {
      processed: notifs.length,
      created: emailSent,
      failed: emailFailed,
      metadata: { emailSent, emailFailed, users: users.length, remaining, hotPosts: hotPosts.data?.length, deadlines: deadlines.data?.length, newBlogs: newBlogs.data?.length },
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
