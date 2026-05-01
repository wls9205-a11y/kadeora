import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Frictionless OAuth callback
 *
 * Flow:
 *   1) exchangeCodeForSession
 *   2) complete_signup_frictionless RPC 1-shot (trigger 가 이미 onboarded=true 프로필 생성)
 *   3) signup_attempts UPDATE (oauth_callback_at, profile_created_at, success=true)
 *   4) 원래 redirect 로 즉시 이동 — /onboarding 강제 리디렉트 제거
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') ?? '/feed';
  // s188: source 가 실제로 URL 에 없을 때 'direct' 디폴트로 가리지 않도록 분리.
  const sourceParam = searchParams.get('source');
  const source = sourceParam ?? 'direct';
  const cookieStore = await cookies();
  // s196: 모바일 OAuth callback drop 75% 진단 — UA/provider/code 존재 여부 로깅
  const ua = request.headers.get('user-agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  console.log(`[auth/callback] entry mobile=${isMobile} source="${source}" hasCode=${!!code} redirect="${redirect}" ua="${ua.slice(0, 80)}"`);

  // Open redirect 방어
  const isSafeInternalPath = (p: string): boolean => {
    if (!p || typeof p !== 'string') return false;
    if (!p.startsWith('/')) return false;
    if (p.startsWith('//') || p.startsWith('/\\')) return false;
    if (/^\/[\t\r\n\v\f ]/.test(p)) return false;
    return true;
  };
  const safeRedirect = isSafeInternalPath(redirect) ? redirect : '/feed';

  if (!code) {
    console.warn(`[auth/callback] missing_code mobile=${isMobile} source="${source}" — redirect to /login?error=auth_failed`);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { try { return cookieStore.getAll(); } catch { return []; } },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
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
    const ipRaw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
    const ipHash = ipRaw ? Buffer.from(ipRaw).toString('base64').slice(0, 24) : null;

    // 기존 attempt row (oauth_started_at 있는 것) 을 갱신, 없으면 신규 INSERT
    const { data: existingAttempt } = await (admin as any)
      .from('signup_attempts')
      .select('id')
      .eq('provider', provider)
      .eq('source', source)
      .eq('ip_hash', ipHash)
      .gte('oauth_started_at', new Date(Date.now() - 15 * 60_000).toISOString())
      .is('oauth_callback_at', null)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAttempt?.id) {
      // s221: source 를 referer_section 에도 그대로 backfill (s220 이 컬럼만 추가하고 누락)
      await (admin as any).from('signup_attempts').update({
        oauth_callback_at: nowIso,
        profile_created_at: rpcOk ? nowIso : null,
        success: rpcOk,
        onboarding_skipped: true,
        redirect_path: safeRedirect,
        referer_section: source,
        error_message: rpcOk ? null : 'frictionless_rpc_failed',
      }).eq('id', existingAttempt.id);
    } else {
      await (admin as any).from('signup_attempts').insert({
        provider, source, redirect_path: safeRedirect,
        ip_hash: ipHash, user_agent: ua.slice(0, 300),
        success: rpcOk,
        oauth_callback_at: nowIso,
        profile_created_at: rpcOk ? nowIso : null,
        onboarding_skipped: true,
        referer_section: source,
        error_message: rpcOk ? null : 'frictionless_rpc_failed',
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

  // 즉시 목적지로 이동 — /onboarding 강제 리디렉트 제거
  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
