import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('landmark_apts')
    .select('name, region, district, avg_price_100m, avg_jeonse_100m, nearby_station, built_year')
    .order('region', { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
