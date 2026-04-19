import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { provider, source, redirect_path, success, error_message, onboarding_skipped } = body || {};
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '';
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;
    const ua = req.headers.get('user-agent')?.slice(0, 500) || null;

    // 세션 143: fire-and-forget — 즉시 200 반환, DB insert는 백그라운드
    try {
      const sb = getSupabaseAdmin();
      (sb as any)
        .from('signup_attempts')
        .insert({
          provider: provider || 'unknown',
          source: source || null,
          redirect_path: redirect_path || null,
          ip_hash: ipHash,
          user_agent: ua,
          success: success ?? false,
          error_message: error_message || null,
          onboarding_skipped: onboarding_skipped ?? null,
          oauth_started_at: new Date().toISOString(),
          dropped_step: 'oauth_start',
        })
        .then(() => {})
        .catch(() => {});
    } catch {
      // insert 실패해도 응답은 성공
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
