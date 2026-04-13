import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { Resend } from 'resend';
import { reEngagementEmail } from '@/lib/email-templates';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sb = auth.admin as any;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY 미설정' }, { status: 500 });

  const { target = 'test', testEmail, previewOnly = false } = await req.json();

  const campaign = target === 'test' ? 're-engagement_test'
    : target === 'dormant' ? 're-engagement_dormant'
    : 're-engagement_all';

  const resend = new Resend(apiKey);

  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await sb.from('email_send_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent').gte('created_at', todayStart.toISOString());
    const remaining = 100 - (sentToday || 0);
    if (remaining <= 0 && target !== 'test')
      return NextResponse.json({ error: `오늘 Resend 한도 초과 (100통/일). 내일 다시 시도하세요.` });

    let recipients: { email: string; nickname: string; userId?: string }[] = [];

    if (target === 'test') {
      recipients = [{ email: testEmail || 'norich92@gmail.com', nickname: '테스트' }];
    } else {
      const { data: subs } = await sb.from('email_subscribers')
        .select('email').eq('is_active', true).is('unsubscribed_at', null);
      if (!subs?.length) return NextResponse.json({ error: '대상자 없음', count: 0 });

      const rawEmails: string[] = subs.map((s: any) => s.email as string)
        .filter((e: string) => !e.includes('kadeora.test') && !e.includes('kadeora.com'));

      const { data: sent } = await sb.from('email_send_logs')
        .select('recipient_email').eq('campaign', campaign).eq('status', 'sent');
      const sentSet = new Set((sent || []).map((s: any) => s.recipient_email as string));
      const targetEmails = rawEmails.filter((e: string) => !sentSet.has(e));
      if (!targetEmails.length) return NextResponse.json({ error: '발송 대상 없음 (이미 전송 완료)', count: 0 });

      const emailToUserId: Record<string, string> = {};
      let page = 1;
      while (true) {
        const { data: { users }, error } = await sb.auth.admin.listUsers({ page, perPage: 100 } as any);
        if (error || !users?.length) break;
        for (const u of users) {
          if (u.email && targetEmails.includes(u.email)) emailToUserId[u.email] = u.id;
        }
        if (users.length < 100) break;
        page++;
      }

      const userIds = Object.values(emailToUserId);
      const profileMap: Record<string, { nickname: string; last_active_at: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await sb.from('profiles')
          .select('id, nickname, last_active_at').in('id', userIds);
        for (const p of (profiles || [])) profileMap[p.id] = p;
      }

      const DORMANT_MS = 30 * 86400000;
      for (const email of targetEmails) {
        const userId = emailToUserId[email];
        const profile = userId ? profileMap[userId] : null;
        const nickname = profile?.nickname || email.split('@')[0];
        if (target === 'dormant' && profile?.last_active_at) {
          if (Date.now() - new Date(profile.last_active_at).getTime() < DORMANT_MS) continue;
        }
        recipients.push({ email, nickname, userId: userId || undefined });
      }
    }

    if (!recipients.length) return NextResponse.json({ error: '발송 대상 없음', count: 0 });
    if (previewOnly) return NextResponse.json({ ok: true, preview: true, count: recipients.length, remaining });

    const sendable = target === 'test' ? recipients : recipients.slice(0, remaining);
    const utmCampaign = new Date().toISOString().slice(0, 7).replace('-', '_');
    const results: { email: string; ok: boolean; id?: string; error?: string }[] = [];

    // Resend rate limit: 초당 2건 → 1건씩 순차 + 550ms 간격 (안전하게 1.8req/s)
    for (const r of sendable) {
      try {
        const subject = `${r.nickname}님, 놓치고 있는 투자 정보가 있어요 📊`;
        const html = reEngagementEmail({ nickname: r.nickname, email: r.email, utmCampaign });
        const { data, error } = await resend.emails.send({
          from: '카더라 <noreply@kadeora.app>', to: r.email, subject, html,
        });
        await sb.from('email_send_logs').insert({
          campaign, recipient_email: r.email, user_id: r.userId || null,
          status: error ? 'failed' : 'sent', resend_id: data?.id || null,
          error_message: error?.message || null,
          subject,
        });
        results.push({ email: r.email, ok: !error, id: data?.id, error: error?.message });
      } catch (e: any) {
        await sb.from('email_send_logs').insert({
          campaign, recipient_email: r.email, user_id: r.userId || null,
          status: 'failed', error_message: e?.message || 'unknown',
        });
        results.push({ email: r.email, ok: false, error: e?.message });
      }
      await new Promise(res => setTimeout(res, 550));
    }

    const sentCount = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    return NextResponse.json({
      ok: true, campaign, target, total: recipients.length,
      sent: sentCount, failed: failed.length,
      failedEmails: failed.map(r => ({ email: r.email, error: r.error })),
      skippedByLimit: recipients.length - sendable.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sb = auth.admin as any;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [logsRes, todayRes, totalSubsRes, unsubRes, newSubsWeekRes, newSubsMonthRes, trackingRes] = await Promise.all([
    sb.from('email_send_logs')
      .select('id, campaign, recipient_email, status, created_at, error_message, opened_at, clicked_at, open_count, click_count, clicked_url, subject, resend_id')
      .order('created_at', { ascending: false }).limit(50),
    sb.from('email_send_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent').gte('created_at', todayStart.toISOString()),
    sb.from('email_subscribers')
      .select('id', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('email_subscribers')
      .select('id', { count: 'exact', head: true }).eq('is_active', false),
    sb.from('email_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true).gte('subscribed_at', weekAgo),
    sb.from('email_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true).gte('subscribed_at', monthAgo),
    // 트래킹 통계
    sb.from('email_send_logs')
      .select('campaign, status, opened_at, clicked_at, open_count, click_count')
      .gte('created_at', monthAgo),
  ]);

  const logs = logsRes.data || [];
  const sentToday = todayRes.count || 0;

  // 캠페인별 통계 집계
  const summary: Record<string, {
    sent: number; failed: number; delivered: number; bounced: number; complained: number;
    opened: number; clicked: number; total_opens: number; total_clicks: number;
    open_rate: number; click_rate: number;
  }> = {};

  for (const log of (trackingRes.data || [])) {
    if (!summary[log.campaign]) {
      summary[log.campaign] = { sent: 0, failed: 0, delivered: 0, bounced: 0, complained: 0, opened: 0, clicked: 0, total_opens: 0, total_clicks: 0, open_rate: 0, click_rate: 0 };
    }
    const s = summary[log.campaign];
    if (log.status === 'sent' || log.status === 'delivered') s.sent++;
    else if (log.status === 'failed') s.failed++;
    else if (log.status === 'delivered') s.delivered++;
    else if (log.status === 'bounced') s.bounced++;
    else if (log.status === 'complained') s.complained++;
    if (log.opened_at) s.opened++;
    if (log.clicked_at) s.clicked++;
    s.total_opens += (log.open_count || 0);
    s.total_clicks += (log.click_count || 0);
  }

  // 오픈율/클릭율 계산
  for (const campaign of Object.keys(summary)) {
    const s = summary[campaign];
    s.open_rate = s.sent > 0 ? Math.round(s.opened / s.sent * 100) : 0;
    s.click_rate = s.sent > 0 ? Math.round(s.clicked / s.sent * 100) : 0;
  }

  // 전체 통계
  const allData = trackingRes.data || [];
  const totalSent = allData.filter((l: any) => l.status === 'sent' || l.status === 'delivered').length;
  const totalOpened = allData.filter((l: any) => l.opened_at).length;
  const totalClicked = allData.filter((l: any) => l.clicked_at).length;

  return NextResponse.json({
    logs,
    summary,
    sentToday,
    remaining: 100 - sentToday,
    overall: {
      totalSent,
      totalOpened,
      totalClicked,
      openRate: totalSent > 0 ? Math.round(totalOpened / totalSent * 100) : 0,
      clickRate: totalSent > 0 ? Math.round(totalClicked / totalSent * 100) : 0,
    },
    subscribers: {
      active: totalSubsRes.count || 0,
      unsubscribed: unsubRes.count || 0,
      newThisWeek: newSubsWeekRes.count || 0,
      newThisMonth: newSubsMonthRes.count || 0,
    },
  });
}
