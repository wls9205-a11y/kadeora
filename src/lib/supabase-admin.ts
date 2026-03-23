import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateEnv, env } from './env-validate';
import type { Database } from '@/types/database';

let _admin: SupabaseClient<Database> | null = null;

// Service Role 클라이언트 — RLS 무시. 서버 API에서만 사용!
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!_admin) {
    validateEnv();
    _admin = createClient<Database>(
      env('NEXT_PUBLIC_SUPABASE_URL'),
      env('SUPABASE_SERVICE_ROLE_KEY')
    );
  }
  return _admin;
}
