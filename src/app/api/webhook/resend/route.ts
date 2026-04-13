import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Resend 웹훅 — 이메일 이벤트 트래킹
 * POST /api/webhook/resend
 *
 * Resend Dashboard → Webhooks에서 등록:
 * URL: https://kadeora.app/api/webhook/resend
 * 이벤트: email.opened, email.clicked, email.delivered, email.bounced, email.complained
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
