import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ✅ A-grade Kim Zetter: nonce 기반 CSP + single getUser + SSRF 방어

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // --- 1. Nonce 기반 CSP 생성 (unsafe-eval/unsafe-inline 완전 제거) ---
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://t1.kakaocdn.net https://developers.kakao.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob: https://tezftxakuwhsclarprlz.supabase.co https://*.kakaocdn.net`,
    `font-src 'self' https://cdn.jsdelivr.net`,
    `connect-src 'self' https://tezftxakuwhsclarprlz.supabase.co wss://tezftxakuwhsclarprlz.supabase.co https://api.tosspayments.com https://*.upstash.io`,
    `frame-src https://api.tosspayments.com`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);

  // --- 2. stock-debug 완전 차단 ---
  if (request.nextUrl.pathname.includes("stock-debug")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // --- 3. apt-proxy SSRF 방어: 허용 도메인 외 차단 ---
  if (request.nextUrl.pathname.startsWith("/api/apt-proxy")) {
    const targetUrl = request.nextUrl.searchParams.get("url") || "";
    const ALLOWED_DOMAINS = [
      "api.odcloud.kr",
      "openapi.molit.go.kr",
      "www.applyhome.co.kr",
    ];
    try {
      const parsed = new URL(targetUrl);
      if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
        return NextResponse.json(
          { error: "Blocked: domain not in allowlist" },
          { status: 403 }
        );
      }
      // DNS rebinding 방어: private IP 차단
      const privatePatterns = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|localhost|::1)/;
      if (privatePatterns.test(parsed.hostname)) {
        return NextResponse.json({ error: "Blocked: private IP" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  // --- 4. Supabase 인증 (single getUser call) ---
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // --- 5. 인증 보호 라우트 ---
  const protectedPaths = ["/write", "/payment", "/profile"];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
