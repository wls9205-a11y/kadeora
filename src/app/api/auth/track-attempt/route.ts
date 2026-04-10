import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createHash } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { provider, source, redirect_path, success, error_message } = await req.json();
    const sb = getSupabaseAdmin();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '';
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;
    const ua = req.headers.get('user-agent')?.slice(0, 200) || null;

    await (sb as any).from('signup_attempts').insert({
      provider: provider || 'unknown',
      source: source || null,
      redirect_path: redirect_path || null,
      ip_hash: ipHash,
      user_agent: ua,
      success: success ?? false,
      error_message: error_message || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
