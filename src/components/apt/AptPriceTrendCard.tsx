import React from 'react';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface Props {
  region?: string | null;
  sigungu?: string | null;
  aptName?: string | null;
  currentLifecycle?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  totalUnits?: number | null;
}

interface SigunguMonth {
  deal_month: string;
  total_deals: number;
  avg_price_per_pyeong: number | null;
}

function fmtMan(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return '—';
  if (n >= 100000) return `${(n / 10000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(2)}억`;
  return `${Math.round(n).toLocaleString()}만`;
}

function pctColor(p: number, isLight: boolean): string {
  if (p >= 0) return isLight ? '#791F1F' : '#F09595';
  return isLight ? '#0F6E56' : '#5DCAA5';
}

function buildSparklinePath(values: number[]): { line: string; area: string } {
  if (values.length < 2) return { line: '', area: '' };
  const finite = values.filter(v => Number.isFinite(v));
  if (finite.length < 2) return { line: '', area: '' };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || 1;
  const W = 100;
  const H = 30;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = Number.isFinite(v) ? H - ((v - min) / range) * (H - 4) - 2 : H - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(' ');
  const area = `0,${H} ${pts.join(' ')} ${W},${H}`;
  return { line, area };
}

export default async function AptPriceTrendCard({ region, sigungu, aptName, priceMin, priceMax }: Props) {
  if (!region || !sigungu) return null;

  const sb = getSupabaseAdmin();
  const [trendRes, summaryRes] = await Promise.all([
    (sb as any).from('v_sigungu_trade_stats')
      .select('deal_month, total_deals, avg_price_per_pyeong')
      .eq('region_nm', region)
      .eq('sigungu', sigungu)
      .order('deal_month', { ascending: false })
      .limit(12),
    (sb as any).from('v_apt_with_local_price')
      .select('sigungu_pyeong_recent, sigungu_pyeong_year_ago, sigungu_change_pct_1y, sigungu_deals_recent_month')
      .eq('region', region)
      .eq('sigungu', sigungu)
      .limit(1).maybeSingle(),
  ]);

  const trend = (((trendRes as any)?.data ?? []) as SigunguMonth[])
    .filter(r => r.avg_price_per_pyeong != null)
    .reverse(); // ascending for sparkline left→right

  const summary = (summaryRes as any)?.data as Record<string, any> | null;
  if (trend.length < 2 || !summary?.sigungu_pyeong_recent) return null;

  const recentPyeong = Number(summary.sigungu_pyeong_recent);
  const changePct = summary.sigungu_change_pct_1y != null ? Number(summary.sigungu_change_pct_1y) : null;
  const totalDealsYear = trend.reduce((sum, r) => sum + (Number(r.total_deals) || 0), 0);

  const values = trend.map(r => Number(r.avg_price_per_pyeong) || 0);
  const sparkline = buildSparklinePath(values);
  const lineColorLight = changePct != null ? pctColor(changePct, true) : '#791F1F';
  const lineColorDark = changePct != null ? pctColor(changePct, false) : '#F09595';

  // 분양 추정가: priceMax (만원) ÷ avg_area(34평 가정) — apt_sites에 평형 안 보장이라 단순화
  // 임시: priceMax / 34 = 평당가 (만)
  const estPyeongPrice = priceMax ? Math.round(priceMax / 34) : null;
  const premiumX = estPyeongPrice && recentPyeong > 0 ? (estPyeongPrice / recentPyeong) : null;

  return (
    <section
      aria-label="시세 트렌드"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', margin: '0 0 12px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5 }}>인근 시세 트렌드</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#FAC775', padding: '2px 8px', borderRadius: 999, background: 'rgba(250,199,117,0.12)', border: '1px solid rgba(250,199,117,0.32)', letterSpacing: 0.5 }}>
          CARDERA
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: 0.5 }}>
            {sigungu} 평당 평균
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: -0.5, lineHeight: 1.1 }}>
              {fmtMan(recentPyeong)}
            </span>
            {changePct != null && (
              <span className="apt-trend-pct" style={{ fontSize: 14, fontWeight: 800, color: lineColorLight }}>
                {changePct > 0 ? '↑' : changePct < 0 ? '↓' : '→'} {Math.abs(changePct).toFixed(1)}%
              </span>
            )}
            <style>{`.apt-trend-pct { color: ${lineColorLight}; } @media (prefers-color-scheme: dark) { .apt-trend-pct { color: ${lineColorDark} !important; } }`}</style>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 2 }}>
            최근 1년 거래 {totalDealsYear.toLocaleString()}건
          </div>
        </div>

        {/* sparkline */}
        {sparkline.line && (
          <svg width="120" height="36" viewBox="0 0 100 30" preserveAspectRatio="none" style={{ flexShrink: 0 }} aria-label="12개월 평당가 트렌드">
            <polygon points={sparkline.area} fill={lineColorLight} fillOpacity="0.12" />
            <polyline points={sparkline.line} fill="none" stroke={lineColorLight} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            <style>{`@media (prefers-color-scheme: dark) { polygon { fill: ${lineColorDark} !important; } polyline { stroke: ${lineColorDark} !important; } }`}</style>
          </svg>
        )}
      </div>

      {estPyeongPrice && premiumX != null && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(250,199,117,0.08)', border: '1px solid rgba(250,199,117,0.28)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
          분양 추정 평당 <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{fmtMan(estPyeongPrice)}</span> ({aptName || '단지'}) → 시군구 평균의{' '}
          <span style={{ color: '#FAC775', fontWeight: 800 }}>{premiumX.toFixed(1)}배</span>
        </div>
      )}
    </section>
  );
}
