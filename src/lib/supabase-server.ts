import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// ✅ A-grade Guillermo Rauch: 
// SSR에서 Supabase 클라이언트는 request-scoped여야 함 (cookie 의존)
// service_role 클라이언트만 싱글톤으로 캐시

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서는 set 불가
          }
        },
      },
    }
  );
}

// Service Role 클라이언트 — 싱글톤 (쿠키 불필요, connection pool 보호)
import { createClient } from "@supabase/supabase-js";

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;

export function getServiceSupabaseClient() {
  if (!serviceClient) {
    serviceClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return serviceClient;
}
