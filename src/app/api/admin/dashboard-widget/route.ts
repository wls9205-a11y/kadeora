// /admin 대시보드 가입 진단 위젯 데이터.
// RPC admin_dashboard_signup_widget() 단일 호출, 30s unstable_cache.
// 실패 시 ok:false + error 200 보장.

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const fetchWidget = unstable_cache(
  async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb: any = getSupabaseAdmin();
    const { data, error } = await sb.rpc('admin_dashboard_signup_widget');
    if (error) throw error;
    return data;
  },
  ['admin-dashboard-signup-widget'],
  { revalidate: 30, tags: ['admin-dashboard-signup-widget'] },
);

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const data = await fetchWidget();
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
