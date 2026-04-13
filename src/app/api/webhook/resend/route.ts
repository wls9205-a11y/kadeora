import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createHmac } from 'crypto';

/**
 * Resend 웹훅 — 이메일 이벤트 트래킹
 * POST /api/webhook/resend
 *
 * Resend Dashboard → Webhooks에서 등록:
 * URL: https://kadeora.app/api/webhook/resend
 * 이벤트: email.opened, email.clicked, email.delivered, email.bounced, email.complained
 *
 * 서명 검증: svix-signature 헤더 (RESEND_WEBHOOK_SECRET 설정 시 활성화)
 */

function verifyWebhookSignature(payload: string, req: NextRequest): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // 시크릿 미설정 시 스킵 (개발 환경)

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // 타임스탬프 검증 (5분 이내)
  const ts = parseInt(svixTimestamp);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // HMAC-SHA256 서명 검증 (svix 포맷: whsec_로 시작하는 base64 키)
  const secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  // svix-signature는 "v1,xxx" 형식 (쉼표로 여러 서명 가능)
  return svixSignature.split(' ').some(sig => {
    const [, hash] = sig.split(',');
    return hash === expected;
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // 서명 검증
    if (!verifyWebhookSignature(rawBody, req)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { type, data } = body;
    if (!type || !data) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const emailId = data.email_id as string | undefined;
    if (!emailId) return NextResponse.json({ ok: true, skipped: 'no email_id' });

    switch (type) {
      case 'email.opened':
        await (sb as any).rpc('increment_email_open', { p_resend_id: emailId });
        break;

      case 'email.clicked':
        await (sb as any).rpc('increment_email_click', { p_resend_id: emailId });
        if (data.click?.link) {
          await (sb as any).from('email_send_logs')
            .update({ clicked_url: data.click.link })
            .eq('resend_id', emailId).is('clicked_url', null);
        }
        break;

      case 'email.delivered':
        await (sb as any).from('email_send_logs')
          .update({ status: 'delivered' }).eq('resend_id', emailId).eq('status', 'sent');
        break;

      case 'email.bounced':
        await (sb as any).from('email_send_logs')
          .update({ status: 'bounced', error_message: data.bounce?.message || 'bounced' })
          .eq('resend_id', emailId);
        if (data.to) {
          await (sb as any).from('email_subscribers')
            .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
            .eq('email', data.to);
        }
        break;

      case 'email.complained':
        await (sb as any).from('email_send_logs')
          .update({ status: 'complained' }).eq('resend_id', emailId);
        if (data.to) {
          await (sb as any).from('email_subscribers')
            .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
            .eq('email', data.to);
        }
        break;
    }

    return NextResponse.json({ ok: true, type });
  } catch (e: any) {
    console.error('[webhook/resend]', e);
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}
