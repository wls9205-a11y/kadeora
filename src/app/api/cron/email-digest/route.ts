import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;

/**
 * email-digest — 매주 월요일 09:00 KST (0 0 * * 1)
 * 
 * weekly-digest를 대체: 실제 Resend 이메일 발송
 * 대상: marketing_agreed = true
 * 
 * Resend 무료: 100통/일, 3,000통/월
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('email-digest', async () => {
    const sb = getSupabaseAdmin();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // 마케팅 동의 실유저
    const { data: users } = await sb.from('profiles')
      .select('id, nickname')
      .eq('marketing_agreed', true)
      .neq('is_seed', true).neq('is_deleted', true);

    if (!users?.length) return { processed: 0, metadata: { reason: 'no_marketing_users' } };

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

    // 이메일 발송 (Resend)
    let emailSent = 0, emailFailed = 0;
    try {
      const { sendNotificationEmail } = await import('@/lib/email-sender');

      const hotPostsHtml = (hotPosts.data || []).map((p: any, i: number) =>
        `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="color:#3B7BF6;font-weight:700;">${i + 1}.</span>
          <a href="https://kadeora.app/feed/${p.slug}?utm_source=email&utm_medium=digest" style="color:#E2E8F0;text-decoration:none;font-size:13px;">${p.title}</a>
          <span style="color:rgba(255,255,255,0.3);font-size:11px;margin-left:6px;">❤️ ${p.likes_count}</span>
        </div>`
      ).join('');

      const deadlinesHtml = (deadlines.data || []).map((d: any) =>
        `<span style="display:inline-block;padding:3px 8px;margin:2px;border-radius:6px;background:rgba(239,68,68,0.1);color:#EF4444;font-size:11px;">${d.house_nm} ~${d.rcept_endde?.slice(5)}</span>`
      ).join('');

      const body = `
        <p style="font-size:14px;color:#E2E8F0;margin:0 0 16px;">이번 주 카더라 하이라이트</p>
        ${hotPostsHtml ? `<div style="margin:0 0 16px;"><p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0 0 6px;">🔥 인기글</p>${hotPostsHtml}</div>` : ''}
        ${deadlinesHtml ? `<div style="margin:0 0 16px;"><p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0 0 6px;">🏠 이번 주 청약 마감</p>${deadlinesHtml}</div>` : ''}
        <div style="text-align:center;margin:20px 0;">
          <a href="https://kadeora.app/blog?utm_source=email&utm_medium=digest&utm_campaign=weekly" style="display:inline-block;padding:12px 32px;border-radius:10px;background:#FEE500;color:#191919;font-size:14px;font-weight:800;text-decoration:none;">전체 확인하기 →</a>
        </div>`;

      // 배치 발송 (10명씩, 1초 딜레이)
      for (let i = 0; i < Math.min(users.length, 80); i += 10) { // 일일 100통 한도 → 80명
        const batch = users.slice(i, i + 10);
        await Promise.all(batch.map(async (u) => {
          try {
            const { data: authUser } = await sb.auth.admin.getUserById(u.id);
            if (!authUser?.user?.email) return;
            const r = await sendNotificationEmail(
              authUser.user.email,
              `${u.nickname || '회원'}님의 주간 투자 리포트 📊`,
              body
            );
            if (r.ok) emailSent++; else emailFailed++;
          } catch { emailFailed++; }
        }));
        if (i + 10 < users.length) await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) { console.error('[email-digest]', e); }

    return {
      processed: notifs.length,
      metadata: { emailSent, emailFailed, users: users.length, hotPosts: hotPosts.data?.length, deadlines: deadlines.data?.length },
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
