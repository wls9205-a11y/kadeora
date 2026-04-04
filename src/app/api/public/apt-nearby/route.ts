import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const apt = sp.get('apt');
  const sigungu = sp.get('sigungu');
  if (!apt || !sigungu) return NextResponse.json({ error: 'apt and sigungu required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('get_nearby_apt_compare', { p_apt_name: apt, p_sigungu: sigungu, p_limit: 5 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
