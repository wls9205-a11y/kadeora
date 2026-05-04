import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';
import { errMsg } from '@/lib/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SendBody = {
  campaign_id?: string;
  segment_name: string;
  recipient_user_ids: string[];
  message_type: 'ad' | 'info';
  title: string;
  body: string;
};

function ensureAdCompliance(rawBody: string): string {
  let b = rawBody ?? '';
  if (!/^\(광고\)/.test(b)) {
    b = '(광고) ' + b;
  }
  if (!/(수신거부|무료\s*수신거부)/.test(b)) {
    b = b + '\n무료 수신거부: 080-000-0000';
  }
  return b;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const raw = (await req.json().catch(() => ({}))) as Partial<SendBody>;
    const segment_name = typeof raw.segment_name === 'string' ? raw.segment_name : '';
    const message_type = raw.message_type === 'ad' ? 'ad' : 'info';
    const title = typeof raw.title === 'string' ? raw.title : '';
    const recipients: string[] = Array.isArray(raw.recipient_user_ids) ? raw.recipient_user_ids.filter((x) => typeof x === 'string') : [];
    const campaign_id = typeof raw.campaign_id === 'string' && raw.campaign_id ? raw.campaign_id : crypto.randomUUID();

    let bodyText = typeof raw.body === 'string' ? raw.body : '';
    if (message_type === 'ad') {
      bodyText = ensureAdCompliance(bodyText);
    }

    if (!segment_name || !title || !bodyText || recipients.length === 0) {
      return NextResponse.json({ error: 'segment_name, title, body, recipient_user_ids are required' }, { status: 400 });
    }

    const sb: any = getSupabaseAdmin();
    const kakaoKey = process.env.KAKAO_REST_API_KEY;

    let delivered = 0;
    const by_reason: Record<string, number> = {};

    for (const user_id of recipients) {
      const sent_at = new Date().toISOString();
      let delivery_status = 'failed';

      try {
        const { data: guard, error: guardErr } = await sb.rpc('kakao_send_guard_check', {
          p_user_id: user_id,
          p_message_type: message_type,
          p_send_at: sent_at,
        });
        if (guardErr) throw guardErr;

        const g = Array.isArray(guard) ? guard[0] : guard;
        const passed: boolean = !!g?.passed;
        const status_code: string = g?.status_code ?? 'unknown';

        if (passed) {
          if (kakaoKey) {
            try {
              const resp = await fetch('https://kapi.kakao.com/v1/talkchannel/users', {
                method: 'POST',
                headers: {
                  Authorization: `KakaoAK ${kakaoKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_id, title, body: bodyText, message_type }),
              });
              if (resp.status === 200 || resp.status === 204) {
                delivery_status = 'delivered';
              } else {
                delivery_status = 'failed';
              }
            } catch {
              delivery_status = 'failed';
            }
          } else {
            delivery_status = 'mock';
          }
        } else {
          delivery_status = status_code;
        }
      } catch {
        delivery_status = 'failed';
      }

      if (delivery_status === 'delivered' || delivery_status === 'mock') {
        delivered += 1;
      } else {
        by_reason[delivery_status] = (by_reason[delivery_status] ?? 0) + 1;
      }

      await sb.from('kakao_message_send_logs').insert({
        campaign_id,
        user_id,
        segment_name,
        message_type,
        title,
        body: bodyText,
        delivery_status,
        sent_at,
      });
    }

    return NextResponse.json({
      campaign_id,
      total: recipients.length,
      delivered,
      blocked: { by_reason },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
