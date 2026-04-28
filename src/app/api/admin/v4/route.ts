import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';

export const maxDuration = 10;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getDashboard = unstable_cache(
  async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb: any = getSupabaseAdmin();
    const { data, error } = await sb.from('v_admin_dashboard_v4').select('data').single();
    if (error) throw error;
    return data?.data ?? null;
  },
  ['admin-dashboard-v4'],
  { revalidate: 60, tags: ['admin-v4'] },
);

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const data = await getDashboard();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
