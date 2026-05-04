import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errMsg } from '@/lib/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.KAKAO_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 });
    }

    const rawBody = await req.text();
    const sig = req.headers.get('x-kakao-signature') ?? '';
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    const kakao_sub: string | undefined =
      (typeof payload?.kakao_sub === 'string' && payload.kakao_sub) ||
      (payload?.user && (typeof payload.user.id === 'string' || typeof payload.user.id === 'number') ? String(payload.user.id) : undefined);

    if (!kakao_sub) {
      return NextResponse.json({ error: 'kakao_sub missing' }, { status: 400 });
    }

    const sb: any = getSupabaseAdmin();
    const { error } = await sb
      .from('profiles')
      .update({ kakao_channel_added: false })
      .eq('kakao_sub', kakao_sub);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
