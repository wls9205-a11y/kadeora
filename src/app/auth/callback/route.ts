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
      
      const source = searchParams.get('source') ?? 'direct';
      const provider = data.user.app_metadata?.provider ?? 'unknown';
      const { data: existing } = await supabase.from('profiles').select('id, interests, onboarded, signup_source, created_at').eq('id', data.user.id).maybeSingle();
      
      // 신규 유저 판별: profile이 60초 이내에 생성됐으면 신규 (트리거가 먼저 생성하므로)
      const isNewUser = existing && (Date.now() - new Date(existing.created_at).getTime() < 60000);

      // signup_source + avatar 업데이트 (신규/기존 모두)
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (avatarUrl) updates.avatar_url = avatarUrl;
      if (!existing?.signup_source) updates.signup_source = source;
      if (isNewUser) {
        updates.provider = provider;
        updates.nickname = meta?.full_name ?? meta?.name ?? data.user.email?.split('@')[0] ?? '사용자';
        updates.nickname_set = true;
        updates.signup_return_url = redirect;
      }
      await supabase.from('profiles').update(updates).eq('id', data.user.id);

      // 가입 성공 추적 (신규만)
      if (isNewUser) {
        try {
          const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
          await (getSupabaseAdmin() as any).from('signup_attempts').insert({
            provider, source, redirect_path: redirect, success: true,
          });
        } catch {}
      }

      if (!existing || isNewUser || !existing.onboarded) {
        // 신규 or 온보딩 미완료 → 퀵온보딩
        const safeRedirect = redirect.startsWith('/') ? redirect : '/feed';
        return NextResponse.redirect(`${origin}/onboarding?return=${encodeURIComponent(safeRedirect)}`);
      } else {
        // 기존 유저 — 바로 리다이렉트
        const safeRedirect = redirect.startsWith('/') ? redirect : '/feed';
        return NextResponse.redirect(`${origin}${safeRedirect}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}