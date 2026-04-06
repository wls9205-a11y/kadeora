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
      // 프로필 upsert (신규: insert / 기존: avatar 갱신)
      const meta = data.user.user_metadata;
      const avatarUrl = (meta?.avatar_url || meta?.picture || null)?.replace('http://', 'https://') ?? null;
      
      // 먼저 기존 프로필 확인
      const { data: existing } = await supabase.from('profiles').select('id, avatar_url').eq('id', data.user.id).maybeSingle();
      
      if (!existing) {
        // 신규 유저 — insert (온보딩 스킵: 카카오 닉네임 자동 설정)
        await supabase.from('profiles').insert({
          id: data.user.id,
          nickname: meta?.full_name ?? meta?.name ?? data.user.email?.split('@')[0] ?? '사용자',
          avatar_url: avatarUrl,
          provider: data.user.app_metadata?.provider ?? null,
          onboarded: true,
          nickname_set: true,
          updated_at: new Date().toISOString(),
        });
      } else if (avatarUrl && !existing.avatar_url) {
        // 기존 유저 — avatar 없으면 OAuth 사진으로 채움
        await supabase.from('profiles').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', data.user.id);
      }

      // 기존 미온보딩 유저도 자동 완료 처리
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded, nickname_set')
        .eq('id', data.user.id)
        .single();

      if (profile && (!profile.onboarded || !profile.nickname_set)) {
        await supabase.from('profiles').update({ onboarded: true, nickname_set: true }).eq('id', data.user.id);
      }

      const safeRedirect = redirect.startsWith('/') ? redirect : '/feed';
      return NextResponse.redirect(`${origin}${safeRedirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}