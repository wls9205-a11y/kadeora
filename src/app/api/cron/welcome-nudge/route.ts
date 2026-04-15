import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 30;

/**
 * welcome-nudge 크론 — 가입 후 D+1, D+3 맞춤 알림
 * v2: 인앱 알림 + 이메일 발송 (미온보딩 유저 대상 외부 리인게이지먼트)
 *
 * D+1: 관심 설정 유도 (인앱 + 이메일)
 * D+3: 놓친 혜택 강조 (인앱 + 이메일, 미활동 유저만)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('welcome-nudge', async () => {
    const sb = getSupabaseAdmin();
    let sent = 0;
    let emailsSent = 0;
    let failed = 0;

    // 이메일 발송 유틸 lazy import
    let sendEmail: ((to: string, subject: string, html: string) => Promise<{ ok: boolean }>) | null = null;
    let buildNudgeEmail: ((args: { nickname: string; email: string; variant: 'd1' | 'd3' }) => { subject: string; html: string }) | null = null;
    try {
      const { sendNotificationEmail } = await import('@/lib/email-sender');
      const { onboardingNudgeEmail } = await import('@/lib/email-templates');
      sendEmail = sendNotificationEmail;
      buildNudgeEmail = onboardingNudgeEmail;
    } catch {}

    // ── D+1 유저 (가입 24~48시간) ──
    const d1Start = new Date(Date.now() - 48 * 3600000).toISOString();
    const d1End = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: d1Users } = await sb.from('profiles')
      .select('id, nickname, region_text, onboarded')
      .gte('created_at', d1Start).lte('created_at', d1End)
      .neq('is_seed', true).neq('is_ghost', true);

    for (const u of d1Users || []) {
      // 중복 방지: 이미 D+1 알림을 보낸 적 있으면 건너뛰기
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

      // 웹 푸시 발송
      try {
        const { sendPushToUsers } = await import('@/lib/push-utils');
        sendPushToUsers([u.id], {
          title: '🎁 첫 미션 안내',
          body: `${region} 지역 청약 소식이 기다리고 있어요!`,
          url: '/feed', tag: `welcome-d1-${u.id}`,
        }).catch(() => {});
      } catch {}

      // 이메일 발송 — 미온보딩 유저에게만 (온보딩 완료 유도)
      if (!u.onboarded && sendEmail && buildNudgeEmail) {
        try {
          const { data: authUser } = await sb.auth.admin.getUserById(u.id);
          const email = authUser?.user?.email;
          if (email) {
            // 이메일 수신 거부 체크
            const { data: unsub } = await sb.from('email_subscribers')
              .select('is_active').eq('email', email).maybeSingle();
            if (!unsub || unsub.is_active !== false) {
              const { subject, html } = buildNudgeEmail({
                nickname: u.nickname || '회원', email, variant: 'd1',
              });
              const res = await sendEmail(email, subject, html);
              if (res.ok) emailsSent++;
            }
          }
        } catch (e) { console.error('[welcome-nudge] d1 email error:', e); failed++; }
      }
      sent++;
    }

    // ── D+3 유저 (가입 72~96시간, 활동 0건) ──
    const d3Start = new Date(Date.now() - 96 * 3600000).toISOString();
    const d3End = new Date(Date.now() - 72 * 3600000).toISOString();
    const { data: d3Users } = await sb.from('profiles')
      .select('id, nickname, onboarded')
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

      // 이메일 발송 — 미온보딩 유저에게만 D+3 혜택 강조
      if (!u.onboarded && sendEmail && buildNudgeEmail) {
        try {
          const { data: authUser } = await sb.auth.admin.getUserById(u.id);
          const email = authUser?.user?.email;
          if (email) {
            const { data: unsub } = await sb.from('email_subscribers')
              .select('is_active').eq('email', email).maybeSingle();
            if (!unsub || unsub.is_active !== false) {
              const { subject, html } = buildNudgeEmail({
                nickname: u.nickname || '회원', email, variant: 'd3',
              });
              const res = await sendEmail(email, subject, html);
              if (res.ok) emailsSent++;
            }
          }
        } catch (e) { console.error('[welcome-nudge] d3 email error:', e); failed++; }
      }
      sent++;
    }

    return {
      processed: (d1Users?.length || 0) + (d3Users?.length || 0),
      created: sent,
      failed,
      metadata: { emailsSent },
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
