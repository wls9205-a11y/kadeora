import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearchQuery } from '@/lib/sanitize';

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const term = sanitizeSearchQuery(q, 30);
  const sb = await createSupabaseServer();

  const { data } = await (sb as any).from('apt_complex_profiles')
    .select('apt_name, sigungu, region_nm, dong, age_group, latest_sale_price, latest_jeonse_price, latest_monthly_deposit, latest_monthly_rent, jeonse_ratio, sale_count_1y, rent_count_1y, built_year, avg_sale_price_pyeong, latitude, longitude')
    .ilike('apt_name', `%${term}%`)
    .order('sale_count_1y', { ascending: false })
    .limit(20);

  const results = (data || []).map((p: any) => ({
    aptName: p.apt_name, sigungu: p.sigungu, region: p.region_nm, dong: p.dong || '',
    builtYear: p.built_year || 0, saleCount: p.sale_count_1y || 0, rentCount: p.rent_count_1y || 0,
    lastPrice: p.latest_sale_price || 0, jeonse: p.latest_jeonse_price || 0,
    monthly: p.latest_monthly_deposit || 0, monthlyRent: p.latest_monthly_rent || 0,
    ageGroup: p.age_group || '', jeonseRatio: p.jeonse_ratio || null,
    pyeongPrice: p.avg_sale_price_pyeong || 0, hasCoords: !!(p.latitude && p.longitude),
  }));

  return NextResponse.json({ results }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
