import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const fetchTraffic = unstable_cache(
  async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb: any = getSupabaseAdmin();
    const { data, error } = await sb.from('v_admin_traffic_live').select('*').single();
    if (error) throw error;
    return data;
  },
  ['admin-v4-traffic'],
  { revalidate: 60, tags: ['admin-v4-traffic'] },
);

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json({ ok: true, data: await fetchTraffic() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
