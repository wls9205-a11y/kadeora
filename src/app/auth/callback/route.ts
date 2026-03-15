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
      // 프로필 upsert (신규 유저)
      await supabase.from('profiles').upsert({
        id: data.user.id,
        nickname: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? data.user.email?.split('@')[0] ?? '사용자',
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
        provider: data.user.app_metadata?.provider ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id', ignoreDuplicates: true });

      // onboarded 여부 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded, nickname_set')
        .eq('id', data.user.id)
        .single();

      // 온보딩 미완료 시 → /onboarding
      if (!profile?.onboarded || !profile?.nickname_set) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      const safeRedirect = redirect.startsWith('/') ? redirect : '/feed';
      return NextResponse.redirect(`${origin}${safeRedirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}