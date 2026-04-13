import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { Resend } from 'resend';
import { reEngagementEmail } from '@/lib/email-templates';

export const maxDuration = 60;

/**
 * POST /api/admin/send-email
 * body: { campaign?: string, target: 'all' | 'dormant' | 'test', testEmail?: string, previewOnly?: boolean }
 *
 * Resend 무료: 100통/일, 3,000통/월
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sb = auth.admin as any;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY 미설정' }, { status: 500 });

  const { target = 'test', testEmail, previewOnly = false } = await req.json();

  // campaign 이름에 target 포함 (dormant/all 구분)
  const campaign = target === 'test' ? 're-engagement_test'
    : target === 'dormant' ? 're-engagement_dormant'
    : 're-engagement_all';

  const resend = new Resend(apiKey);

  try {
    // ── 오늘 잔여 발송 한도 체크 ──────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await sb
      .from('email_send_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', todayStart.toISOString());
    const remaining = 100 - (sentToday || 0);
    if (remaining <= 0 && target !== 'test') {
      return NextResponse.json({ error: `오늘 Resend 한도 초과 (100통/일). 내일 다시 시도하세요.` });
    }

    // ── 대상자 조회 ────────────────────────────────────────────────
    let recipients: { email: string; nickname: string; userId?: string }[] = [];

    if (target === 'test') {
      const email = testEmail || 'norich92@gmail.com';
      recipients = [{ email, nickname: '테스트' }];
    } else {
      // 1) email_subscribers 활성 목록
      const { data: subs } = await sb
        .from('email_subscribers')
        .select('email')
        .eq('is_active', true)
        .is('unsubscribed_at', null);

      if (!subs?.length) return NextResponse.json({ error: '대상자 없음', count: 0 });

      const rawEmails: string[] = subs
        .map((s: any) => s.email as string)
        .filter((e: string) => !e.includes('kadeora.test') && !e.includes('kadeora.com'));

      // 2) 이미 이 campaign으로 발송된 이메일 제외
      const { data: sent } = await sb
        .from('email_send_logs')
        .select('recipient_email')
        .eq('campaign', campaign)
        .eq('status', 'sent');
      const sentSet = new Set((sent || []).map((s: any) => s.recipient_email as string));
      const targetEmails = rawEmails.filter((e: string) => !sentSet.has(e));

      if (!targetEmails.length) return NextResponse.json({ error: '발송 대상 없음 (이미 전송 완료)', count: 0 });

      // 3) profiles 배치 조회 (N+1 제거) — auth listUsers 페이지네이션으로 email→id 맵 구성
      const emailToUserId: Record<string, string> = {};
      let page = 1;
      while (true) {
        const { data: { users }, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
        if (error || !users?.length) break;
        for (const u of users) {
          if (u.email && targetEmails.includes(u.email)) {
            emailToUserId[u.email] = u.id;
          }
        }
        if (users.length < 100) break;
        page++;
      }

      // 4) profiles IN 쿼리 한 방에 (닉네임 + last_active_at)
      const userIds = Object.values(emailToUserId);
      const profileMap: Record<string, { nickname: string; last_active_at: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await sb
          .from('profiles')
          .select('id, nickname, last_active_at')
          .in('id', userIds);
        for (const p of (profiles || [])) {
          profileMap[p.id] = { nickname: p.nickname, last_active_at: p.last_active_at };
        }
      }

      // 5) dormant 필터링 (30일 기준)
      const DORMANT_THRESHOLD_MS = 30 * 86400000;
      for (const email of targetEmails) {
        const userId = emailToUserId[email];
        const profile = userId ? profileMap[userId] : null;
        const nickname = profile?.nickname || email.split('@')[0];

        if (target === 'dormant') {
          // 30일 이내 활성 유저는 제외 (프로필 없는 비회원은 dormant로 간주)
          if (profile?.last_active_at) {
            const inactive = Date.now() - new Date(profile.last_active_at).getTime();
            if (inactive < DORMANT_THRESHOLD_MS) continue;
          }
        }

        recipients.push({ email, nickname, userId: userId || undefined });
      }
    }

    if (!recipients.length) return NextResponse.json({ error: '발송 대상 없음', count: 0 });

    // previewOnly: 실제 발송 없이 카운트만 반환
    if (previewOnly) {
      return NextResponse.json({ ok: true, preview: true, count: recipients.length, remaining });
    }

    // 잔여 한도 초과 방지: 발송 수 자르기
    const sendable = target === 'test' ? recipients : recipients.slice(0, remaining);
    if (sendable.length < recipients.length) {
      console.warn(`[send-email] 한도로 인해 ${sendable.length}/${recipients.length}만 발송`);
    }

    // ── 발송 (10개씩 배치, 배치 간 1초) ─────────────────────────
    const utmCampaign = `${new Date().toISOString().slice(0, 7).replace('-', '_')}`;
    const results: { email: string; ok: boolean; id?: string; error?: string }[] = [];
    const batchSize = 10;

    for (let i = 0; i < sendable.length; i += batchSize) {
      const batch = sendable.slice(i, i + batchSize);
      const batchRes = await Promise.all(batch.map(async (r) => {
        try {
          const subject = `${r.nickname}님, 놓치고 있는 투자 정보가 있어요 📊`;
          const html = reEngagementEmail({ nickname: r.nickname, email: r.email, utmCampaign });
          const { data, error } = await resend.emails.send({
            from: '카더라 <noreply@kadeora.app>',
            to: r.email,
            subject,
            html,
          });
          await sb.from('email_send_logs').insert({
            campaign,
            recipient_email: r.email,
            user_id: r.userId || null,
            status: error ? 'failed' : 'sent',
            resend_id: data?.id || null,
            error_message: error?.message || null,
          });
          return { email: r.email, ok: !error, id: data?.id, error: error?.message };
        } catch (e: any) {
          await sb.from('email_send_logs').insert({
            campaign, recipient_email: r.email, user_id: r.userId || null,
            status: 'failed', error_message: e?.message || 'unknown',
          });
          return { email: r.email, ok: false, error: e?.message };
        }
      }));
      results.push(...batchRes);
      if (i + batchSize < sendable.length) await new Promise(res => setTimeout(res, 1000));
    }

    const sentCount = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);

    return NextResponse.json({
      ok: true, campaign, target,
      total: recipients.length,
      sent: sentCount,
      failed: failed.length,
      failedEmails: failed.map(r => ({ email: r.email, error: r.error })),
      skippedByLimit: recipients.length - sendable.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/send-email — 발송 이력 + 오늘 잔여 한도
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sb = auth.admin as any;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [logsRes, todayRes] = await Promise.all([
    sb.from('email_send_logs')
      .select('campaign, recipient_email, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    sb.from('email_send_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', todayStart.toISOString()),
  ]);

  const logs = logsRes.data || [];
  const sentToday = todayRes.count || 0;

  const summary: Record<string, { sent: number; failed: number }> = {};
  for (const log of logs) {
    if (!summary[log.campaign]) summary[log.campaign] = { sent: 0, failed: 0 };
    if (log.status === 'sent') summary[log.campaign].sent++;
    else summary[log.campaign].failed++;
  }

  return NextResponse.json({ logs, summary, sentToday, remaining: 100 - sentToday });
}
