import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

// 탭별 데이터만 가져오는 경량 API
// 기존: page.tsx에서 전체 5탭 데이터 한번에 → 클라이언트로 전송 (수MB)
// 개선: 활성 탭만 필요할 때 fetch → 초기 payload 80% 감소

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab');
  const region = searchParams.get('region') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');

  const sb = getSupabaseAdmin();

  try {
    if (tab === 'transactions') {
      const year = new Date(Date.now() + 9 * 60 * 60 * 1000).getFullYear();
      let q = sb.from('apt_transactions')
        .select('id, apt_name, region_nm, sigungu, dong, deal_date, deal_amount, exclusive_area, floor, built_year, trade_type, created_at')
        .gte('deal_date', `${year}-01-01`)
        .order('deal_date', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
      if (region && region !== '전체') q = q.ilike('region_nm', `%${region}%`);
      const [{ data, count }, tradeMonthlyR] = await Promise.all([
        q,
        sb.from('apt_trade_monthly_stats').select('stat_month, region, total_deals, avg_price, total_amount').order('stat_month', { ascending: true }),
      ]);
      return NextResponse.json({
        data: data || [],
        count,
        tradeMonthly: tradeMonthlyR.data || [],
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      });
    }

    if (tab === 'redevelopment') {
      let q = sb.from('redevelopment_projects')
        .select('*')
        .eq('is_active', true)
        .order('total_households', { ascending: false });
      if (region && region !== '전체') q = q.ilike('region', `%${region}%`);
      const { data } = await q;
      return NextResponse.json({ data: data || [] }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    if (tab === 'unsold') {
      let q = sb.from('unsold_apts')
        .select('*')
        .eq('is_active', true)
        .order('tot_unsold_hshld_co', { ascending: false });
      if (region && region !== '전체') q = q.ilike('region_nm', `%${region}%`);
      const [{ data }, monthlyR, summaryR] = await Promise.all([
        q,
        sb.from('unsold_monthly_stats').select('stat_month, region, total_unsold, total_after_completion').order('stat_month', { ascending: true }),
        sb.from('apt_cache').select('data').eq('cache_type', 'unsold_summary').maybeSingle(),
      ]);
      return NextResponse.json({
        data: data || [],
        unsoldMonthly: monthlyR.data || [],
        unsoldSummary: summaryR?.data || null,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
