import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createHash } from 'crypto';

// s267_b: OAuth callback infinite loop 회귀 fix — NextResponse.cookies 명시 패턴 으로
// session cookie 가 redirect 응답에 attach 보장. 기존 cookies()/cookieStore.set 은 Next 15
// Route Handler + NextResponse.redirect 조합에서 Set-Cookie 헤더 미전파 케이스 존재 →
// session 누락 → 사용자 재시도 → /auth/callback → /login → Kakao 클릭 → /authorize 반복.
// 60h+ 가입 0건 (popup_signup_modal CTR 4.04% 유지인데 auth.users 0) 의 root cause.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Frictionless OAuth callback
 *
 * Flow:
 *   1) exchangeCodeForSession → response.cookies 에 session cookie 명시 set
 *   2) complete_signup_frictionless RPC 1-shot (trigger 가 이미 onboarded=true 프로필 생성)
 *   3) signup_attempts UPDATE (oauth_callback_at, profile_created_at, success=true)
 *   4) 원래 redirect 로 즉시 이동 — /onboarding 강제 리디렉트 제거
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') ?? '/';
  // s188: source 가 실제로 URL 에 없을 때 'direct' 디폴트로 가리지 않도록 분리.
  const sourceParam = searchParams.get('source');
  const source = sourceParam ?? 'direct';
  // s196: 모바일 OAuth callback drop 75% 진단 — UA/provider/code 존재 여부 로깅
  const ua = request.headers.get('user-agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  // SU A-2: track-attempt 가 시작 시 심은 상관관계 id. 매칭의 1순위이며,
  // 응답에서 반드시 지운다(다음 로그인이 남의 행을 갱신하지 않게).
  const attemptCookieRaw = request.cookies.get('kd_att')?.value ?? '';
  const attemptIdFromCookie = /^\d+$/.test(attemptCookieRaw) ? Number(attemptCookieRaw) : null;
  console.log(`[auth/callback] entry mobile=${isMobile} source="${source}" hasCode=${!!code} redirect="${redirect}" ua="${ua.slice(0, 80)}"`);

  // Open redirect 방어
  const isSafeInternalPath = (p: string): boolean => {
    if (!p || typeof p !== 'string') return false;
    if (!p.startsWith('/')) return false;
    if (p.startsWith('//') || p.startsWith('/\\')) return false;
    if (/^\/[\t\r\n\v\f ]/.test(p)) return false;
    return true;
  };
  // r4-P7: 기본 랜딩을 홈으로. isSafeInternalPath('/') 는 통과한다
  // (startsWith('/') 참, '//' · '/\\' · '/<공백>' 아님).
  const safeRedirect = isSafeInternalPath(redirect) ? redirect : '/';

  if (!code) {
    console.warn(`[auth/callback] missing_code mobile=${isMobile} source="${source}" — redirect to /login?error=auth_failed`);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // s267_b: response 를 미리 생성하고 cookies adapter 가 직접 response.cookies 에 set.
  // 결과적으로 exchangeCodeForSession 이후 session cookie 가 redirect 응답에 명시 attach.
  // Placeholder response — 실제 redirect 는 함수 끝에서 destination 으로 cookies 복사.
  let pendingResponse = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            pendingResponse.cookies.set(name, value, options as Record<string, unknown>);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    console.warn(`[auth/callback] exchange_failed mobile=${isMobile} source="${source}" err=${error?.message ?? 'no_user'}`);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const user = data.user;
  // SU B-2: 「성공 8」과 「실가입 4」의 괴리를 signup_attempts 안에서 가르는 자.
  //   재로그인도 success=true 라 성공 수만으로는 신규를 셀 수 없었다.
  const isNewUser = (() => {
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : NaN;
    return Number.isFinite(createdAt) ? Date.now() - createdAt < 5 * 60_000 : null;
  })();
  const meta = user.user_metadata ?? {};
  const avatarUrl = (meta?.avatar_url || meta?.picture || null)?.replace('http://', 'https://') ?? null;
  const provider = (user.app_metadata?.provider ?? 'unknown') as string;
  console.log(`[auth/callback] success mobile=${isMobile} source="${source}" provider=${provider} user=${user.id.slice(0, 8)}`);
  const fallbackNickname =
    (meta?.full_name as string | undefined)
    || (meta?.name as string | undefined)
    || user.email?.split('@')[0]
    || '사용자';

  // 1-shot frictionless RPC: 트리거가 이미 onboarded=true 프로필 생성했으면 idempotent 로 success.
  //                         stuck 상태였다면 자동 구제.
  let rpcOk = false;
  try {
    const rpcRes = await supabase.rpc('complete_signup_frictionless', {
      p_user_id: user.id,
      p_source: source,
      p_nickname: fallbackNickname,
    });
    rpcOk = !rpcRes?.error;
  } catch { /* fail-open: frictionless RPC 실패해도 로그인은 완료 */ }

  // avatar 업데이트 (옵션)
  if (avatarUrl) {
    try { await supabase.from('profiles').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', user.id); } catch { /* ignore */ }
  }

  // signup_attempts 업데이트 (프로필 생성 추적) + conversion_events cta_complete
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // cta_complete 기록 (fire-and-forget)
    (admin as any).from('conversion_events').insert({
      event_type: 'cta_complete',
      cta_name: source,
      category: 'signup',
      page_path: safeRedirect,
      visitor_id: user.id,
    }).then(() => {}).catch(() => {});
    const ua = request.headers.get('user-agent') || '';
    // s260 P0: track-attempt 와 동일한 sha256/16 hex 알고리즘으로 통일.
    // 기존 base64/24 는 track-attempt 측 sha256/16 와 매칭 실패 → existingAttempt
    // 룩업 0건 → INSERT 분기로 진입하여 oauth_started_at 누락된 row 누적.
    const ipRaw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const ipHash = ipRaw ? createHash('sha256').update(ipRaw).digest('hex').slice(0, 16) : null;

    // 기존 attempt row (oauth_started_at 있는 것) 을 갱신, 없으면 신규 INSERT
    // SU A-2: 매칭 1순위는 «추측» 이 아니라 시작 시 발급한 상관관계 id 다.
    let attemptId: number | null = attemptIdFromCookie;
    if (attemptId != null) {
      const { data: byCookie } = await (admin as any)
        .from('signup_attempts').select('id').eq('id', attemptId).maybeSingle();
      if (!byCookie?.id) attemptId = null; // 쿠키가 가리키는 행이 없으면 폴백으로
    }

    // 폴백 — 쿠키가 없거나(구버전 탭·차단 환경) 가리키는 행이 없을 때.
    // ⚠️ source 조건을 뺐다: 콜백 URL 의 source 와 시작 행의 source 가 «다른» 사례가
    //    실측됐다(고아 콜백의 절반). source 로 좁히면 시작 행을 못 찾고 새 행을 만든다.
    //    ⛔ 대신 갱신에서 source 를 덮어쓰지 않는다 — 시작 행의 source 가 정본이다(s188).
    if (attemptId == null && ipHash) {
      const { data: existingAttempt } = await (admin as any)
        .from('signup_attempts')
        .select('id')
        .eq('provider', provider)
        .eq('ip_hash', ipHash)
        .gte('oauth_started_at', new Date(Date.now() - 15 * 60_000).toISOString())
        .is('oauth_callback_at', null)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingAttempt?.id) attemptId = existingAttempt.id as number;
    }

    if (attemptId != null) {
      await (admin as any).from('signup_attempts').update({
        oauth_callback_at: nowIso,
        profile_created_at: rpcOk ? nowIso : null,
        success: rpcOk,
        onboarding_skipped: true,
        redirect_path: safeRedirect,
        error_message: rpcOk ? null : 'frictionless_rpc_failed',
        is_new_user: isNewUser,
      }).eq('id', attemptId);
    } else {
      await (admin as any).from('signup_attempts').insert({
        provider, source, redirect_path: safeRedirect,
        ip_hash: ipHash, user_agent: ua.slice(0, 300),
        success: rpcOk,
        oauth_callback_at: nowIso,
        profile_created_at: rpcOk ? nowIso : null,
        onboarding_skipped: true,
        error_message: rpcOk ? null : 'frictionless_rpc_failed',
        is_new_user: isNewUser,
      });
    }
  } catch { /* 로깅 실패는 무시 */ }

  // s188: 진입 source 추적 + apt_interest_<slug> 1-shot 등록
  // s188 fix: void+.then() fire-and-forget 은 NextResponse.redirect 직전에 cancel 되어
  // signup_source 91% 누락의 직접 원인. admin client + await + .is('signup_source', null)
  // (이미 source 가 있으면 덮어쓰지 않음 — 재로그인 시 signup_source 보존).
  try {
    const action = searchParams.get('action');
    if (sourceParam && sourceParam !== 'direct') {
      try {
        const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
        const adminSrc = getSupabaseAdmin();
        await (adminSrc as any)
          .from('profiles')
          .update({ signup_source: sourceParam })
          .eq('id', user.id)
          .is('signup_source', null);
      } catch (e) {
        console.error('[auth/callback] signup_source update failed:', e);
      }
    }
    if (action === 'register_interest' && source && source.startsWith('apt_interest_')) {
      const key = source.slice('apt_interest_'.length);
      if (key) {
        const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
        const admin2 = getSupabaseAdmin();
        // s187 fix: key 가 UUID 일 수도 slug 일 수도 있어 둘 다 시도. UUID 매칭은 ?key 형식으로 OR 검색.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
        const { data: site } = await (admin2 as any)
          .from('apt_sites')
          .select('id')
          .or(isUuid ? `id.eq.${key},slug.eq.${key}` : `slug.eq.${key}`)
          .maybeSingle();
        if (site?.id) {
          // s187 fix: 등록 결과 로깅 — silent fail 방지 (apt_site_interests 0 행 디버그용)
          const { error: insertErr } = await (admin2 as any).from('apt_site_interests').insert({
            site_id: site.id,
            user_id: user.id,
            is_member: true,
            notification_enabled: true,
            source: 'login_callback',
          });
          if (insertErr) {
            console.error('[auth/callback] apt_site_interests insert failed:', insertErr.message, { key, site_id: site.id });
          }
        } else {
          console.warn('[auth/callback] apt_interest registration: site not found for key:', key);
        }
      }
    }
  } catch { /* 등록 실패는 무시 */ }

  // s231: onboarded=false 신규/미완료 사용자는 /onboarding 으로 redirect.
  let needsOnboarding = false;
  try {
    const { data: prof } = await (supabase as any)
      .from('profiles').select('onboarded, residence_city, interests')
      .eq('id', user.id).maybeSingle();
    needsOnboarding = !prof?.onboarded;
  } catch {}
  const dest = needsOnboarding
    ? `/onboarding?return=${encodeURIComponent(safeRedirect)}`
    : safeRedirect;
  // s260 P0: ?welcome=1 부착 — WelcomeToast 가 신규 가입 직후 토스트 표시.
  const sep = dest.includes('?') ? '&' : '?';

  // s267_b: pendingResponse 에 누적된 session cookies 를 destination redirect 에 복사.
  // exchangeCodeForSession 이 set 한 sb-* auth-token cookies 가 보존되어야 다음 page
  // 에서 user logged-in 상태로 인식. 누락 시 anon → /login 회귀 → OAuth 루프.
  const finalResponse = NextResponse.redirect(`${origin}${dest}${sep}welcome=1`);
  pendingResponse.cookies.getAll().forEach((c) => {
    finalResponse.cookies.set(c);
  });
  // SU A-2: 사용한 상관관계 쿠키는 즉시 소멸시킨다.
  finalResponse.cookies.set('kd_att', '', { path: '/', maxAge: 0 });
  return finalResponse;
}
