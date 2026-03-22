import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '아파트 청약 일정 · 미분양 · 재개발',
  description: '2026년 전국 아파트 청약 일정, 미분양 현황, 재개발·재건축 진행 현황을 한눈에 확인하세요.',
  openGraph: {
    title: '청약·미분양·재개발',
    description: '전국 아파트 청약 일정, 미분양 현황, 재개발·재건축 진행 현황',
    images: [{ url: 'https://kadeora.app/images/brand/kadeora-full.png', alt: '카더라 청약·미분양·재개발' }],
  },
};
// Cache: 3600s — 청약 정보 (하루 1회 갱신)
export const revalidate = 3600;
import { createSupabaseServer } from '@/lib/supabase-server';
import AptClient from './AptClient';
import Disclaimer from '@/components/Disclaimer';

export default async function AptPage() {
  let apts: any[] = [];
  let unsold: any[] = [];
  let redevelopment: any[] = [];
  let transactions: any[] = [];
  let unsoldSummary: any = null;
  let alertCounts: Record<string, number> = {};
  let lastRefreshed: string | null = null;
  let unsoldMonthly: any[] = [];
  let tradeMonthly: any[] = [];

  try {
    const sb = await createSupabaseServer();

    // Try reading from apt_cache first
    try {
      const { data: cache } = await sb
        .from('apt_cache')
        .select('data, refreshed_at')
        .eq('cache_type', 'apt_subscriptions')
        .maybeSingle();
      if (cache?.data && Array.isArray(cache.data) && cache.data.length > 0) {
        lastRefreshed = cache.refreshed_at;
      }
    } catch {}

    const [aptsR, unsoldR, alertsR, redevelopmentR, unsoldSummaryR, transactionsR, unsoldMonthlyR, tradeMonthlyR] = await Promise.all([
      sb.from('apt_subscriptions').select('*')
        .or(`rcept_endde.gte.${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)},rcept_bgnde.lte.${new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`)
        .order('rcept_bgnde', { ascending: false }).limit(300),
      sb.from('unsold_apts').select('*').eq('is_active', true).order('tot_unsold_hshld_co', { ascending: false }),
      sb.from('apt_alerts').select('house_manage_no'),
      sb.from('redevelopment_projects').select('*').eq('is_active', true).order('total_households', { ascending: false }),
      sb.from('apt_cache').select('data').eq('cache_type', 'unsold_summary').maybeSingle(),
      sb.from('apt_transactions').select('*').gte('deal_date', `${new Date().getFullYear()}-01-01`).order('deal_date', { ascending: false }).limit(2000),
      sb.from('unsold_monthly_stats').select('*').order('stat_month', { ascending: true }),
      sb.from('apt_trade_monthly_stats').select('*').order('stat_month', { ascending: true }),
    ]);
    if (aptsR.data?.length) apts = aptsR.data;
    if (unsoldR.data?.length) unsold = unsoldR.data;
    if (redevelopmentR.data?.length) redevelopment = redevelopmentR.data;
    if (unsoldSummaryR?.data) unsoldSummary = unsoldSummaryR.data;
    if (transactionsR.data?.length) transactions = transactionsR.data;
    if (unsoldMonthlyR.data?.length) unsoldMonthly = unsoldMonthlyR.data;
    if (tradeMonthlyR.data?.length) tradeMonthly = tradeMonthlyR.data;
    (alertsR.data || []).forEach((a: any) => { alertCounts[a.house_manage_no] = (alertCounts[a.house_manage_no] || 0) + 1; });
  } catch {}

  // 지역별 + 상태별 통계 계산
  const today = new Date().toISOString().slice(0, 10);
  const regionDetail: Record<string, { total: number; open: number; upcoming: number; closed: number }> = {};
  apts.forEach((a: any) => {
    const r = a.region_nm || '기타';
    if (!regionDetail[r]) regionDetail[r] = { total: 0, open: 0, upcoming: 0, closed: 0 };
    regionDetail[r].total++;
    if (String(a.rcept_endde ?? '') < today) regionDetail[r].closed++;
    else if (String(a.rcept_bgnde ?? '') <= today) regionDetail[r].open++;
    else regionDetail[r].upcoming++;
  });
  const regionStats = Object.entries(regionDetail).sort((a, b) => b[1].total - a[1].total).map(([name, s]) => ({ name, ...s }));

  return <><AptClient apts={apts} unsold={unsold} redevelopment={redevelopment} transactions={transactions} unsoldSummary={unsoldSummary} alertCounts={alertCounts} lastRefreshed={lastRefreshed} regionStats={regionStats} unsoldMonthly={unsoldMonthly} tradeMonthly={tradeMonthly} /><Disclaimer /></>;
}
