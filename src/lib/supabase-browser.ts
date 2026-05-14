'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Phase 9b-3: module-level singleton — React Strict Mode double-mount + 다중 컴포넌트 호출 시
// 매번 새 client를 만들면 'lock:sb-kadeora-auth-token' 충돌(5초 대기) 발생.
// 한 번만 생성해서 모든 컴포넌트가 공유하면 auth lock 충돌 사라짐.
//
// s268 P0 FIX: 모바일 OAuth callback drop 49.2% 의 root cause.
// 30일간 auth.flow_state 50+건 시작했는데 auth_code_issued_at = NULL 전부.
// 즉 Kakao → Supabase 단계에서 PKCE code 발급 자체가 실패 중.
// 명시적 flowType=pkce + cookieOptions(sameSite=lax/secure) 으로 cross-origin
// redirect 체인에서 code_verifier cookie 가 모바일 Safari/Samsung Browser/Naver inapp 에서도
// 안전하게 보존되도록 강제.
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createSupabaseBrowser() {
  if (_client) return _client;
  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
      cookieOptions: {
        sameSite: 'lax',
        secure: true,
        path: '/',
      },
    }
  );
  return _client;
}
