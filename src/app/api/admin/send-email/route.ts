import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { Resend } from 'resend';
import { reEngagementEmail } from '@/lib/email-templates';

export const maxDuration = 60;

/**
 * POST /api/admin/send-email
 * 
 * body: { campaign: 're-engagement', target: 'all' | 'dormant' | 'test', testEmail?: string }
 * 
 * Resend 무료: 100통/일, 3,000통/월
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sb = auth.admin as any;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY 미설정' }, { status: 500 });

  const { campaign = 're-engagement', target = 'test', testEmail } = await req.json();
  const resend = new Resend(apiKey);

  try {
    // 대상자 조회
    let recipients: { email: string; nickname: string }[] = [];

    if (target === 'test') {
      // 테스트: 특정 이메일만
      const email = testEmail || 'norich92@gmail.com';
      recipients = [{ email, nickname: '테스트' }];
    } else {
      // 실제 발송: email_subscribers JOIN profiles
      const { data: subs } = await sb.from('email_subscribers')
        .select('email')
        .eq('is_active', true)
        .is('unsubscribed_at', null);

      if (!subs || subs.length === 0) {
        return NextResponse.json({ error: '대상자 없음', count: 0 });
      }

      // auth.users에서 닉네임 가져오기
      const emails = subs.map((s: any) => s.email).filter((e: string) =>
        !e.includes('kadeora.test') && !e.includes('kadeora.com')
      );

      // 이미 이 캠페인으로 보낸 이메일 제외
      const { data: sent } = await sb.from('email_send_logs')
        .select('recipient_email')
        .eq('campaign', campaign)
        .eq('status', 'sent');
      const sentSet = new Set((sent || []).map((s: any) => s.recipient_email));

      for (const email of emails) {
        if (sentSet.has(email)) continue;

        // 닉네임 조회 (auth.users → profiles)
        let nickname = email.split('@')[0];
        try {
          const { data: { users } } = await sb.auth.admin.listUsers({ filter: `email.eq.${email}`, perPage: 1 });
          if (users?.[0]?.id) {
            const { data: profile } = await sb.from('profiles').select('nickname, last_active_at').eq('id', users[0].id).single();
            if (profile?.nickname) nickname = profile.nickname;

            // dormant: last_active_at이 3일+ 또는 null
            if (target === 'dormant') {
              if (profile?.last_active_at && Date.now() - new Date(profile.last_active_at).getTime() < 3 * 86400000) continue;
            }
          }
        } catch { /* 닉네임 못 찾으면 이메일 앞부분 사용 */ }

        recipients.push({ email, nickname });
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: '발송 대상 없음', count: 0 });
    }

    // 발송 (Resend 무료 한도: 100통/일)
    const results: { email: string; ok: boolean; id?: string; error?: string }[] = [];
    const batchSize = 10; // 동시 발송 제한

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const promises = batch.map(async (r) => {
        try {
          const subject = `${r.nickname}님, 놓치고 있는 투자 정보가 있어요 📊`;
          const html = reEngagementEmail({ nickname: r.nickname, email: r.email });

          const { data, error } = await resend.emails.send({
            from: '카더라 <noreply@kadeora.app>',
            to: r.email,
            subject,
            html,
          });

          // 발송 로그
          await sb.from('email_send_logs').insert({
            campaign,
            recipient_email: r.email,
            status: error ? 'failed' : 'sent',
            resend_id: data?.id || null,
            error_message: error?.message || null,
          });

          return { email: r.email, ok: !error, id: data?.id, error: error?.message };
        } catch (e: any) {
          await sb.from('email_send_logs').insert({
            campaign,
            recipient_email: r.email,
            status: 'failed',
            error_message: e?.message || 'unknown',
          });
          return { email: r.email, ok: false, error: e?.message };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // 배치 간 1초 딜레이 (Resend rate limit 방지)
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const sent = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    return NextResponse.json({
      ok: true,
      campaign,
      target,
      total: recipients.length,
      sent,
      failed,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/send-email — 발송 이력 조회
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sb = auth.admin as any;

  const { data: logs } = await sb.from('email_send_logs')
    .select('campaign, recipient_email, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  // 캠페인별 요약
  const summary: Record<string, { sent: number; failed: number }> = {};
  for (const log of (logs || [])) {
    if (!summary[log.campaign]) summary[log.campaign] = { sent: 0, failed: 0 };
    if (log.status === 'sent') summary[log.campaign].sent++;
    else summary[log.campaign].failed++;
  }

  return NextResponse.json({ logs, summary });
}
