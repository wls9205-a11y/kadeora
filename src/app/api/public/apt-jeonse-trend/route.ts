import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const apt = sp.get('apt');
  if (!apt) return NextResponse.json({ error: 'apt required' }, { status: 400 });
  const sigungu = sp.get('sigungu') || null;
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('get_apt_jeonse_trend', { p_apt_name: apt, p_sigungu: sigungu, p_months: 24 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
