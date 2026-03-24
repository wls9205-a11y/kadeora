import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  const region = req.nextUrl.searchParams.get('region') || '전국';

  try {
    const sb = getSupabaseAdmin();

    let query = sb
      .from('unsold_apts')
      .select('region_nm, tot_unsold_hshld_co, created_at')
      .eq('is_active', true);

    if (region !== '전국') {
      query = query.eq('region_nm', region);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by month (YYYY-MM) from created_at
    const byMonth: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      const month = row.created_at ? row.created_at.slice(0, 7) : 'unknown';
      byMonth[month] = (byMonth[month] || 0) + (row.tot_unsold_hshld_co || 0);
    });

    const months = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    const totalUnits = (data ?? []).reduce(
      (sum, row) => sum + (row.tot_unsold_hshld_co || 0),
      0,
    );
    const siteCount = (data ?? []).length;
    const monthlyAvg = months.length > 0 ? Math.round(totalUnits / months.length) : 0;

    return NextResponse.json({
      region,
      totalUnits,
      siteCount,
      monthlyAvg,
      months,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
