import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') ?? '/feed';
  const cookieStore = await cookies();

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const meta = data.user.user_metadata;
      const avatarUrl = (meta?.avatar_url || meta?.picture || null)?.replace('http://', 'https://') ?? null;
      
      const { data: existing } = await supabase.from('profiles').select('id, interests, onboarded, signup_source').eq('id', data.user.id).maybeSingle();
      
      const source = searchParams.get('source') ?? 'direct';

      if (!existing) {
        // 신규 유저 — 프로필 생성 (onboarded=false → 퀵온보딩으로)
        await supabase.from('profiles').insert({
          id: data.user.id,
          nickname: meta?.full_name ?? meta?.name ?? data.user.email?.split('@')[0] ?? '사용자',
          avatar_url: avatarUrl,
          provider: data.user.app_metadata?.provider ?? null,
          onboarded: false,
          nickname_set: true,
          signup_source: source,
          signup_return_url: redirect,
          updated_at: new Date().toISOString(),
        });

        // 가입 성공 추적
        try {
          const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
          const sbAdmin = getSupabaseAdmin();
          await (sbAdmin as any).from('signup_attempts').insert({
            provider: data.user.app_metadata?.provider ?? 'unknown',
            source: searchParams.get('source') ?? 'direct',
            redirect_path: redirect,
            success: true,
          });
        } catch {}

        // 신규유저 → 퀵온보딩 (관심사 선택 + 알림 설정) → 원래 페이지로
        const safeRedirect = redirect.startsWith('/') ? redirect : '/feed';
        return NextResponse.redirect(`${origin}/onboarding?return=${encodeURIComponent(safeRedirect)}`);
      } else {
        // 기존 유저 — avatar 갱신 + signup_source 보정
        const updates: Record<string, string> = { updated_at: new Date().toISOString() };
        if (avatarUrl) updates.avatar_url = avatarUrl;
        if (!existing.onboarded && !('signup_source' in existing && existing.signup_source)) {
          (updates as any).signup_source = source;
        }
        await supabase.from('profiles').update(updates).eq('id', data.user.id);
        if (!existing.onboarded) {
          // 미온보딩 기존유저도 퀵온보딩으로
          const safeRedirect = redirect.startsWith('/') ? redirect : '/feed';
          return NextResponse.redirect(`${origin}/onboarding?return=${encodeURIComponent(safeRedirect)}`);
        }
        const safeRedirect = redirect.startsWith('/') ? redirect : '/feed';
        return NextResponse.redirect(`${origin}${safeRedirect}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}