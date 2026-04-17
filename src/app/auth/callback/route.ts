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
          getAll() { try { return cookieStore.getAll(); } catch { return []; } },
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

      // ── Zero-Step 온보딩: CTA 가입자는 온보딩 스킵 ──
      const DIRECT_SOURCES = ['direct', 'nav', 'signup_cta', 'feed', 'sidebar', 'right_panel'];
      const isCTA = !DIRECT_SOURCES.includes(source) || 
        (existing?.signup_source && !DIRECT_SOURCES.includes(existing.signup_source));

      if (isNewUser) {
        updates.provider = provider;
        updates.nickname = meta?.full_name ?? meta?.name ?? data.user.email?.split('@')[0] ?? '사용자';
        updates.nickname_set = true;
        updates.signup_return_url = redirect;
        // CTA 소스 기반 관심사 힌트 (온보딩에서 미리 선택되도록)
        const hintInterests: string[] = [];
        if (redirect.includes('/apt') || source.includes('apt')) hintInterests.push('apt');
        if (redirect.includes('/stock') || source.includes('stock')) hintInterests.push('stock');
        if (redirect.includes('/redev') || source.includes('redev')) hintInterests.push('redev');
        if (hintInterests.length > 0) updates.interests = hintInterests;
      }
      await supabase.from('profiles').update(updates).eq('id', data.user.id);

      // 가입 성공 추적 (신규만)
      if (isNewUser) {
        try {
          const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
          await (getSupabaseAdmin() as any).from('signup_attempts').insert({
            provider, source, redirect_path: redirect, success: true,
            onboarding_skipped: isCTA,
          });
        } catch {}
      }

      // ── 라우팅 분기 ──
      // Open redirect 방어: '/'로 시작하지만 '//' 또는 '/\' 시작 금지 (프로토콜-상대 URL 차단)
      const isSafeInternalPath = (p: string): boolean => {
        if (!p || typeof p !== 'string') return false;
        if (!p.startsWith('/')) return false;
        if (p.startsWith('//') || p.startsWith('/\\')) return false;
        if (/^\/[\t\r\n\v\f ]/.test(p)) return false;
        return true;
      };
      const safeRedirect = isSafeInternalPath(redirect) ? redirect : '/feed';

      // 1) 신규 가입 (CTA든 직접이든): 항상 온보딩으로 → 관심 설정 필수
      if (isNewUser) {
        const sep = safeRedirect.includes('?') ? '&' : '?';
        return NextResponse.redirect(`${origin}/onboarding?return=${encodeURIComponent(safeRedirect)}&welcome=1`);
      }
      // 2) 기존 유저 + 미온보딩: 온보딩으로
      if (existing && !existing.onboarded) {
        return NextResponse.redirect(`${origin}/onboarding?return=${encodeURIComponent(safeRedirect)}`);
      }
      // 3) 기존 유저, 온보딩 완료 → 바로 리다이렉트
      return NextResponse.redirect(`${origin}${safeRedirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}