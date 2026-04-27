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
  const source = searchParams.get('source') ?? 'direct';
  const cookieStore = await cookies();

  // Open redirect 방어
  const isSafeInternalPath = (p: string): boolean => {
    if (!p || typeof p !== 'string') return false;
    if (!p.startsWith('/')) return false;
    if (p.startsWith('//') || p.startsWith('/\\')) return false;
    if (/^\/[\t\r\n\v\f ]/.test(p)) return false;
    return true;
  };
  const safeRedirect = isSafeInternalPath(redirect) ? redirect : '/feed';

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_failed`);

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
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const user = data.user;
  const meta = user.user_metadata ?? {};
  const avatarUrl = (meta?.avatar_url || meta?.picture || null)?.replace('http://', 'https://') ?? null;
  const provider = (user.app_metadata?.provider ?? 'unknown') as string;
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
      await (admin as any).from('signup_attempts').update({
        oauth_callback_at: nowIso,
        profile_created_at: rpcOk ? nowIso : null,
        success: rpcOk,
        onboarding_skipped: true,
        redirect_path: safeRedirect,
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
        error_message: rpcOk ? null : 'frictionless_rpc_failed',
      });
    }
  } catch { /* 로깅 실패는 무시 */ }

  // s183: 진입 source 추적 + apt_interest_<slug> 1-shot 등록
  try {
    const action = searchParams.get('action');
    if (source && source !== 'direct') {
      void supabase.from('profiles').update({ signup_source: source } as any).eq('id', user.id).then(() => {});
    }
    if (action === 'register_interest' && source && source.startsWith('apt_interest_')) {
      const slug = source.slice('apt_interest_'.length);
      if (slug) {
        const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
        const admin2 = getSupabaseAdmin();
        const { data: site } = await (admin2 as any)
          .from('apt_sites').select('id').eq('slug', slug).maybeSingle();
        if (site?.id) {
          void (admin2 as any).from('apt_site_interests').insert({
            site_id: site.id,
            user_id: user.id,
            is_member: true,
            notification_enabled: true,
            source: 'login_callback',
          });
        }
      }
    }
  } catch { /* 등록 실패는 무시 */ }

  // 즉시 목적지로 이동 — /onboarding 강제 리디렉트 제거
  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
