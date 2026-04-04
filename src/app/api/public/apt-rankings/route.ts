import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') || 'price_up';
  const region = sp.get('region') || null;
  const limit = Math.min(parseInt(sp.get('limit') || '20'), 50);
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('get_apt_rankings', {
    p_type: type, p_region: region, p_limit: limit
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
