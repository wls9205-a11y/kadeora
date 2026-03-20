import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PATHS = ['/write', '/payment', '/profile', '/notifications', '/admin'];
const PUBLIC_PATHS = ['/login', '/auth', '/onboarding', '/terms', '/privacy', '/faq'];
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|::1|localhost)/;
const ALLOWED_APT_DOMAINS = ['applyhome.co.kr', 'land.naver.com', 'hogangnono.com'];
const BOT_PATHS = ['/wp-admin', '/wp-login.php', '/.env', '/.git', '/phpmyadmin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 봇 차단 ──
  if (BOT_PATHS.some(p => pathname.startsWith(p))) {
    return new NextResponse(null, { status: 404 });
  }

  // ── API 라우트: rate limit + SSRF 검사만, auth 불필요 ──
  if (pathname.startsWith('/api/')) {
    // Redis Rate Limiting
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (redisUrl && redisToken) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
      try {
        const key = `kd_rl:${ip}`;
        const res = await fetch(`${redisUrl}/incr/${key}`, {
          headers: { Authorization: `Bearer ${redisToken}` },
        });
        const data = await res.json();
        const count = data.result ?? 0;
        if (count === 1) {
          await fetch(`${redisUrl}/expire/${key}/60`, {
            headers: { Authorization: `Bearer ${redisToken}` },
          });
        }
        if (count > 120) {
          return new NextResponse(
            JSON.stringify({ error: '요청이 너무 많습니다' }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
          );
        }
      } catch { /* Redis 장애 시 통과 */ }
    }

    // SSRF 차단 (apt-proxy)
    if (pathname.startsWith('/api/apt-proxy')) {
      const url = request.nextUrl.searchParams.get('url');
      if (url) {
        try {
          const parsed = new URL(url);
          if (PRIVATE_IP_REGEX.test(parsed.hostname))
            return NextResponse.json({ error: 'SSRF blocked' }, { status: 403 });
          if (!ALLOWED_APT_DOMAINS.some(d => parsed.hostname.endsWith(d)))
            return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
        } catch {
          return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }
      }
    }

    // API는 자체 auth 처리 → middleware auth/profile 쿼리 스킵
    return NextResponse.next();
  }

  // ── 페이지 요청만: Supabase auth + 보호 경로 + 온보딩 체크 ──
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  let user = null;
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((r) => setTimeout(() => r({ data: { user: null } }), 3000)),
    ]);
    user = authResult.data.user;
  } catch { }

  // 보호 경로: 미인증 → 로그인 리다이렉트
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 어드민 경로: is_admin 체크 (로그인은 위에서 보장)
  if (pathname.startsWith('/admin') && user) {
    try {
      const adminResult = await Promise.race([
        supabase.from('profiles').select('is_admin').eq('id', user.id).single(),
        new Promise<null>((r) => setTimeout(() => r(null), 2000)),
      ]);
      const adminProfile = (adminResult as any)?.data;
      if (!adminProfile?.is_admin) {
        return NextResponse.redirect(new URL('/feed', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/feed', request.url));
    }
  }

  // 온보딩 체크: 인증된 사용자 + 일반 페이지만 (public 경로 제외)
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  if (user && !isPublic && pathname !== '/onboarding') {
    try {
      const profileResult = await Promise.race([
        supabase.from('profiles').select('onboarded, nickname_set').eq('id', user.id).single(),
        new Promise<null>((r) => setTimeout(() => r(null), 2000)),
      ]);
      const profile = (profileResult as any)?.data;
      if (profile && (!profile.onboarded || !profile.nickname_set)) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    } catch { }
  }

  // ── user 정보를 header에 주입 (layout.tsx에서 DB 호출 없이 읽기) ──
  if (user) {
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-user-logged-in', '1');
  }

  // ── CSP 헤더 ──
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://va.vercel-scripts.com https://js.tosspayments.com https://*.kakaocdn.net https://*.kakao.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.kakaocdn.net",
    "font-src 'self' https://cdn.jsdelivr.net",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://cdn.jsdelivr.net https://*.kakao.com https://*.kakaocdn.net https://accounts.google.com https://api.tosspayments.com https://*.sentry.io https://*.upstash.io https://open.er-api.com",
    "frame-src 'self' https://kauth.kakao.com https://accounts.google.com https://js.tosspayments.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://kauth.kakao.com https://accounts.google.com",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);
  return response;
}

// 정적 파일, 이미지, PWA 에셋 완전 제외 → middleware 자체가 실행되지 않음
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon|icons/|manifest\\.json|sw\\.js|og-image|robots\\.txt|sitemap\\.xml|\\.well-known/|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
};