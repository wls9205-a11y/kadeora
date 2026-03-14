import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 보호된 라우트 정의
  const protectedRoutes = ['/feed', '/stocks', '/housing', '/discuss', '/profile', '/write', '/notifications', '/shop', '/search', '/post']
  const authRoutes = ['/login', '/onboarding']

  const path = request.nextUrl.pathname

  // 보호된 라우트에 비로그인 접근 시 로그인으로 리다이렉트
  if (protectedRoutes.some(route => path.startsWith(route)) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 로그인된 사용자가 인증 라우트 접근 시 피드로 리다이렉트
  if (authRoutes.some(route => path.startsWith(route)) && user) {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|api).*)',
  ],
}
