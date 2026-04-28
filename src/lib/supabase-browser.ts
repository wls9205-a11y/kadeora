'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Phase 9b-3: module-level singleton — React Strict Mode double-mount + 다중 컴포넌트 호출 시
// 매번 새 client를 만들면 'lock:sb-kadeora-auth-token' 충돌(5초 대기) 발생.
// 한 번만 생성해서 모든 컴포넌트가 공유하면 auth lock 충돌 사라짐.
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createSupabaseBrowser() {
  if (_client) return _client;
  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _client;
}
