import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://t1.kakaocdn.net https://developers.kakao.com`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://tezftxakuwhsclarprlz.supabase.co https://*.kakaocdn.net`,
    `font-src 'self' https://cdn.jsdelivr.net`,
    `connect-src 'self' https://tezftxakuwhsclarprlz.supabase.co wss://tezftxakuwhsclarprlz.supabase.co https://api.tosspayments.com https://*.upstash.io`,
    `frame-src https://api.tosspayments.com`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);

  if (request.nextUrl.pathname.includes("stock-debug")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (request.nextUrl.pathname.startsWith("/api/apt-proxy")) {
    const targetUrl = request.nextUrl.searchParams.get("url") || "";
    const ALLOWED_DOMAINS = ["api.odcloud.kr", "openapi.molit.go.kr", "www.applyhome.co.kr"];
    try {
      const parsed = new URL(targetUrl);
      if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
        return NextResponse.json({ error: "Blocked" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  try {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: Array<{name: string; value: string; options: Record<string, unknown>}>) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    const protectedPaths = ["/write", "/payment", "/profile"];
    const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

    if (isProtected && !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch (err) {
    console.error("[middleware] Auth check failed:", err);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
