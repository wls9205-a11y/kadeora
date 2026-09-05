import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

/** 콜백이 시작 행을 «확정적으로» 찾기 위한 상관관계 쿠키. 15분이면 OAuth 왕복에 충분하다. */
const ATTEMPT_COOKIE = 'kd_att';
const ATTEMPT_COOKIE_MAX_AGE = 900;

/**
 * POST /api/auth/track-attempt — signup_attempts 시작 행 기록
 *
 * SU A-2 (2026-09-05): fire-and-forget 을 걷는다.
 *   세션 143 의 fire-and-forget 은 「즉시 200」을 얻는 대신 서버리스 프리즈 시
 *   insert 가 늦게 앉거나 통째로 유실됐다. 그 결과가 «고아 콜백 3/8» —
 *   콜백이 시작 행을 못 찾아 새 행(st=false·cb=true)을 만들고 source 가 'direct'
 *   로 유실된 기록이다.
 *   단일 insert 는 maxDuration 10 안에서 충분히 끝난다. await 하고, 그 행 id 를
 *   응답 쿠키(kd_att)로 돌려준다 — 콜백의 1순위 매칭 키다.
 *   ⛔ 실패해도 200 {ok:true} 는 유지한다(fail-open). 계측이 로그인을 막지 않는다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { provider, source, redirect_path, success, error_message, onboarding_skipped } = body || {};
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '';
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;
    const ua = req.headers.get('user-agent')?.slice(0, 500) || null;

    let attemptId: number | null = null;
    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await (sb as any)
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
          // 의미: 「아직 시작 단계에 머묾」. 콜백이 도달하면 콜백이 지운다(A-4).
          dropped_step: 'oauth_start',
        })
        .select('id')
        .single();
      if (!error && data?.id) attemptId = data.id as number;
    } catch {
      // insert 실패해도 응답은 성공
    }

    const res = NextResponse.json({ ok: true, attempt_id: attemptId });
    if (attemptId != null) {
      res.cookies.set(ATTEMPT_COOKIE, String(attemptId), {
        path: '/',
        maxAge: ATTEMPT_COOKIE_MAX_AGE,
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      });
    }
    return res;
  } catch {
    return NextResponse.json({ ok: true, attempt_id: null });
  }
}
