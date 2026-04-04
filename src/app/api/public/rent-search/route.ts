import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 600;

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  const sp = req.nextUrl.searchParams;
  const region = sp.get('region') || null;
  const sigungu = sp.get('sigungu') || null;
  const aptName = sp.get('apt') || null;
  const rentType = sp.get('type') || null;
  const limit = Math.min(parseInt(sp.get('limit') || '30'), 50);
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('search_rent_transactions', {
    p_region: region, p_sigungu: sigungu, p_apt_name: aptName, p_rent_type: rentType, p_limit: limit
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}
