# ============================================================
# KADEORA 수정 스크립트 3/3
# middleware.ts CSP 수정 + git push
# ============================================================

Set-Location "C:\Users\82105\Documents\kadeora"
$enc = [System.Text.UTF8Encoding]::new($false)

# ── middleware.ts — frame-src와 frame-ancestors 분리 수정 ──
$f = 'src\middleware.ts'
$c = @'
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

  // CSP Header — frame-src와 frame-ancestors 분리 (버그 수정)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://va.vercel-scripts.com https://js.tosspayments.com`,
    `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
    `img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://k.kakaocdn.net`,
    `font-src 'self' https://cdn.jsdelivr.net`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://cdn.jsdelivr.net https://kauth.kakao.com https://accounts.google.com https://api.tosspayments.com`,
    `frame-src 'self' https://kauth.kakao.com https://accounts.google.com https://js.tosspayments.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://kauth.kakao.com https://accounts.google.com`,
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
'@
[System.IO.File]::WriteAllText("$PWD\$f", $c, $enc)
Write-Host "✅ middleware.ts CSP 수정 완료 (frame-src/frame-ancestors 분리)"

# ── git push ──────────────────────────────────────────────────
Write-Host ""
Write-Host "📤 Git push 시작..."
git add -A
git commit -m "fix: Korean encoding + CSP frame-ancestors + heat_score order + CSS variables"
git push origin main
Write-Host ""
Write-Host "🎉 전체 완료! Vercel 자동 배포 중 (약 20초 후 확인)"
Write-Host "   https://kadeora.vercel.app/feed"
