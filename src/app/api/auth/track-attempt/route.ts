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
 * insert 를 기다리는 «상한».
 *
 * ⚠️ 2026-09-05 배포 직후 실측: 새 함수의 첫 인보케이션들이 Supabase 연결을 세우느라
 *    10초(maxDuration)를 넘겨 504 를 다섯 번 냈다. 그다음부터는 0.2초다.
 *    await 로 바꾸면서 «원래 있던 느림» 이 처음으로 표면에 나온 것이다 —
 *    fire-and-forget 이던 시절엔 같은 지연이 조용히 시작 행을 잃고 있었다(고아 콜백).
 * 그래서 서버도 무한정 기다리지 않는다. 상한을 넘기면 id 없이 200 을 돌려주고
 * (쿠키 없음 → 콜백의 폴백 매처가 받는다) insert 는 남은 시간 동안 계속 달린다.
 * ⛔ 504 를 내지 않는다. 계측이 로그인 경로에 에러를 만들면 안 된다.
 */
const INSERT_BUDGET_MS = 4_000;

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
      const insert = (sb as any)
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
      // ⚠️ 타이머를 «끈다». 안 끄면 insert 가 0.2초에 끝나도 이벤트 루프가
      //    상한까지 살아 있어 함수 실행시간이 그만큼 길어진다.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((r) => { timer = setTimeout(() => r(null), INSERT_BUDGET_MS); });
      const settled = await Promise.race([insert, timeout]).finally(() => { if (timer) clearTimeout(timer); });
      const row = settled as { data?: { id?: number }; error?: unknown } | null;
      if (row && !row.error && row.data?.id) attemptId = row.data.id as number;
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
