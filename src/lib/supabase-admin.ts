import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateEnv, env } from './env-validate';

let _admin: SupabaseClient | null = null;

// Service Role 클라이언트 — RLS 무시. 서버 API에서만 사용!
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    validateEnv();
    _admin = createClient(
      env('NEXT_PUBLIC_SUPABASE_URL'),
      env('SUPABASE_SERVICE_ROLE_KEY')
    );
  }
  return _admin;
}
