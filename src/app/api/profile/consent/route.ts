import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse, getIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 5;

type Body = {
  marketing?: boolean;
  night?: boolean;
  onboarded?: boolean;
  channel_action?: 'add' | 'remove' | null;
};

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();

  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Body = {};
    try { body = (await req.json()) as Body; } catch { body = {}; }
    const { marketing, night, onboarded, channel_action } = body;

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {};
    if (typeof marketing === 'boolean') {
      update.marketing_agreed = marketing;
      if (marketing) {
        update.marketing_agreed_at = now;
        update.marketing_consent_renewed_at = now;
      }
    }
    if (typeof night === 'boolean') {
      update.night_consent = night;
      if (night) update.night_consent_at = now;
    }
    if (typeof onboarded === 'boolean') {
      update.onboarded = onboarded;
    }

    const admin = getSupabaseAdmin();

    if (Object.keys(update).length > 0) {
      const { error: updErr } = await (admin as any)
        .from('profiles')
        .update(update)
        .eq('id', user.id);
      if (updErr) {
        console.error('[profile/consent] update', updErr);
        return NextResponse.json({ error: 'update_failed' }, { status: 500 });
      }
    }

    const ip = getIp(req);
    const userAgent = req.headers.get('user-agent') || null;

    const historyRows: Array<Record<string, unknown>> = [];
    if (typeof marketing === 'boolean') {
      historyRows.push({
        user_id: user.id,
        consent_type: 'marketing',
        agreed: marketing,
        source: 'onboarding',
        ip_address: ip,
        user_agent: userAgent,
      });
    }
    if (typeof night === 'boolean') {
      historyRows.push({
        user_id: user.id,
        consent_type: 'night',
        agreed: night,
        source: 'onboarding',
        ip_address: ip,
        user_agent: userAgent,
      });
    }
    if (channel_action) {
      historyRows.push({
        user_id: user.id,
        consent_type: 'kakao_channel',
        agreed: channel_action === 'add',
        source: 'onboarding',
        ip_address: ip,
        user_agent: userAgent,
      });
    }

    if (historyRows.length > 0) {
      try {
        await (admin as any).from('consent_history').insert(historyRows);
      } catch (e) {
        console.error('[profile/consent] history insert', e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[profile/consent]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
