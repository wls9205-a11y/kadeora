import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PATHS = ['/write', '/payment', '/profile'];
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|::1|localhost)/;
const ALLOWED_APT_DOMAINS = ['applyhome.co.kr', 'land.naver.com', 'hogangnono.com'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block apt-proxy SSRF
  if (pathname.startsWith('/api/apt-proxy')) {
    const url = request.nextUrl.searchParams.get('url');
    if (url) {
      try {
        const parsed = new URL(url);
        if (PRIVATE_IP_REGEX.test(parsed.hostname)) {
          return NextResponse.json({ error: 'SSRF blocked' }, { status: 403 });
        }
        const allowed = ALLOWED_APT_DOMAINS.some(d => parsed.hostname.endsWith(d));
        if (!allowed) {
          return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }
    }
  }

  let response = NextResponse.next({ request });

  // Supabase session refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch {
    // Session fetch failed, treat as unauthenticated
  }

  // Protected route guard
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (isProtected && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // CSP Header
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://va.vercel-scripts.com https://js.tosspayments.com`,
    `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
    `img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://k.kakaocdn.net`,
    `font-src 'self' https://cdn.jsdelivr.net`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
