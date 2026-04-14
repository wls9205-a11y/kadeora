import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PROTECTED_PATHS = ['/write', '/payment', '/profile', '/notifications', '/admin'];
const PUBLIC_PATHS = ['/login', '/auth', '/onboarding', '/terms', '/privacy', '/faq'];
const BOT_PATHS = ['/wp-admin', '/wp-login.php', '/.env', '/.git', '/phpmyadmin'];

// CSP 정책 (단일 정의 — 중복 방지)
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://va.vercel-scripts.com https://js.tosspayments.com https://*.kakaocdn.net https://*.kakao.com https://dapi.kakao.com https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.googleadservices.com",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' https://cdn.jsdelivr.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://cdn.jsdelivr.net https://*.kakao.com https://*.kakaocdn.net https://*.daumcdn.net https://accounts.google.com https://api.tosspayments.com https://*.sentry.io https://*.upstash.io https://open.er-api.com https://www.google-analytics.com https://*.google-analytics.com https://*.googletagmanager.com https://www.google.com https://google.com https://googleads.g.doubleclick.net https://www.googleadservices.com",
  "frame-src 'self' https://kauth.kakao.com https://accounts.google.com https://js.tosspayments.com",
  "frame-ancestors 'self' https://*.tossmini.com",
  "base-uri 'self'",
  "form-action 'self' https://kauth.kakao.com https://sharer.kakao.com https://accounts.google.com https://www.googletagmanager.com",
].join('; ');

/** 보안 헤더 일괄 적용 */
function applySecurityHeaders(response: NextResponse) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
  response.headers.set('x-nonce', nonce);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('Content-Language', 'ko');
  // Last-Modified: 정적 빌드 시각 고정 — 매 요청 갱신 방지 (크롤 예산 보호)
  if (!response.headers.has('Last-Modified')) {
    // Vercel ISR이 자체적으로 Last-Modified를 관리하도록 설정하지 않음
    // 동적 페이지는 revalidate 주기에 따라 Vercel이 처리
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // XSS URL probing defense
  try {
    const decoded = decodeURIComponent(pathname);
    if (/<|>|<script|<template|javascript:/i.test(decoded)) {
      return new NextResponse('Bad Request', { status: 400 });
    }
  } catch {
    // malformed URI — block it
    return new NextResponse('Bad Request', { status: 400 });
  }

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

    // CSRF 방어: POST/PATCH/DELETE API에 Origin 헤더 검증
    const method = request.method;
    if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
      // 크론/웹훅은 제외 (Authorization 헤더로 인증)
      const isCron = pathname.startsWith('/api/cron/');
      const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ');
      if (!isCron && !hasBearer) {
        const origin = request.headers.get('origin');
        const host = request.headers.get('host');
        if (origin && host && !origin.includes(host) && !origin.includes('kadeora.app') && !origin.includes('localhost') && !origin.includes('tossmini.com')) {
          return NextResponse.json({ error: 'CSRF: Origin mismatch' }, { status: 403 });
        }
      }
    }

    // API는 자체 auth 처리 → middleware auth/profile 쿼리 스킵
    return NextResponse.next();
  }

  // ── 페이지 요청만: Supabase auth + 보호 경로 + 온보딩 체크 ──
  let response = NextResponse.next({ request });

  // 공개 전용 페이지: auth 체크 없이 바로 통과 (속도 대폭 향상)
  const PUBLIC_ONLY = ['/', '/feed', '/stock', '/apt', '/blog', '/discuss', '/hot', '/search', '/faq', '/terms', '/privacy', '/guide', '/grades', '/discussion'];
  const isPublicOnly = PUBLIC_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'));
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));

  // 공개 페이지이고 보호 경로가 아니면 → auth 스킵, CSP만 붙여서 바로 반환
  if (isPublicOnly && !isProtected) {
    // 쿠키에 세션이 있으면 최소한 헤더에 표시 (layout에서 사용)
    // Supabase는 큰 JWT를 청크로 분할: sb-xxx-auth-token.0, .1 등
    const hasSession = request.cookies.getAll().some(c =>
      c.name.startsWith('sb-') && c.name.includes('-auth-token')
    );
    if (hasSession) {
      response.headers.set('x-user-logged-in', '1');
    }
    // CSP + 보안 헤더
    applySecurityHeaders(response);
    return response;
  }

  // ── 보호 경로 및 기타: Supabase auth 필요 ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: CookieOptions }) => response.cookies.set(name, value, options as Record<string, unknown>));
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
  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 어드민 경로: is_admin 체크 (로그인은 위에서 보장)
  if (pathname.startsWith('/admin') && user) {
    try {
      const adminResult = await Promise.race([
        supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
        new Promise<null>((r) => setTimeout(() => r(null), 2000)),
      ]);
      const adminProfile = (adminResult as { data: Record<string, unknown> | null })?.data;
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
        supabase.from('profiles').select('onboarded, nickname_set').eq('id', user.id).maybeSingle(),
        new Promise<null>((r) => setTimeout(() => r(null), 2000)),
      ]);
      const profile = (profileResult as { data: Record<string, unknown> | null })?.data;
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

  // ── CSP + 보안 헤더 ──
  applySecurityHeaders(response);
  return response;
}

// 정적 파일, 이미지, PWA 에셋 완전 제외 → middleware 자체가 실행되지 않음
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon|icons/|manifest\\.json|sw\\.js|og-image|robots\\.txt|sitemap\\.xml|\\.well-known/|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
};