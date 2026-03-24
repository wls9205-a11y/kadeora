import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 어드민 권한 검증 — 모든 /api/admin/* 라우트에서 사용
 * @returns { user, admin, supabase } 또는 에러 응답
 */
export async function requireAdmin(): Promise<
  | { user: { id: string }; admin: ReturnType<typeof getSupabaseAdmin>; supabase: ReturnType<typeof getSupabaseAdmin>; error?: never }
  | { error: NextResponse }
> {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

    return { user, admin, supabase: admin };
  } catch {
    return { error: NextResponse.json({ error: 'Auth failed' }, { status: 500 }) };
  }
}
