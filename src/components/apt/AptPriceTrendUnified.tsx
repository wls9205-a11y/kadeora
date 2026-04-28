// 서버 — 시군구 시세 12개월 + 가격대 5 그룹 토글.
'use client';

import { useRouter } from 'next/navigation';
import type { SigunguTradeRow, PriceBandBucket } from '@/lib/apt-fetcher';

interface Props {
  region: string;
  sigungu: string | null;
  trends: SigunguTradeRow[];   // 12개월 ascending (오래된 → 최신)
  priceBands: PriceBandBucket[];
  activePrice?: string;
  // 다른 query state 보존용
  category?: string;
  builder?: string;
}

function fmtPriceMan(v: number | null | undefined): string {
  if (!v || v <= 0) return '-';
  if (v >= 10_000) return `${(v / 10_000).toFixed(1)}억`;
  return `${Math.round(v).toLocaleString()}만`;
}

function buildHrefBand(band: string, props: Props): string {
  const p = new URLSearchParams();
  p.set('region', props.region);
  if (props.sigungu) p.set('sigungu', props.sigungu);
  if (props.category && props.category !== 'all') p.set('category', props.category);
  if (props.builder) p.set('builder', props.builder);
  if (props.activePrice !== band) p.set('price', band);
  return `/apt?${p.toString()}`;
}

export default function AptPriceTrendUnified(props: Props) {
  const router = useRouter();
  const { region, sigungu, trends, priceBands, activePrice } = props;
  const label = sigungu ? `${region} ${sigungu}` : region;

  // 차트용 SVG 좌표 계산 (단순 line chart)
  const W = 320, H = 80, PADX = 8, PADY = 8;
  const values = trends.map((t) => Number(t.avg_price_per_pyeong) || 0).filter((v) => v > 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  const points = trends.map((t, i) => {
    const x = trends.length > 1 ? PADX + (i / (trends.length - 1)) * (W - 2 * PADX) : W / 2;
    const v = Number(t.avg_price_per_pyeong) || 0;
    const y = H - PADY - ((v - min) / range) * (H - 2 * PADY);
    return { x, y, v, m: t.deal_month };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${H - PADY} L ${points[0].x.toFixed(1)} ${H - PADY} Z`
    : '';

  const last = points.length ? points[points.length - 1] : null;
  const first = points.length ? points[0] : null;
  const yoyPct = first && last && first.v > 0 ? ((last.v - first.v) / first.v) * 100 : null;

  return (
    <section
      aria-label="시세 트렌드 + 가격대"
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <div
        style={{
          padding: '12px 14px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            📈 {label} 평당가 12개월
          </h2>
          {last && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {last.m} · {fmtPriceMan(last.v)}
              {yoyPct !== null && (
                <span style={{ marginLeft: 6, fontWeight: 800, color: yoyPct >= 0 ? 'var(--accent-red, #DC2626)' : 'var(--accent-blue, #2563EB)' }}>
                  {yoyPct >= 0 ? '+' : ''}{yoyPct.toFixed(1)}%
                </span>
              )}
            </span>
          )}
        </div>
        {/* 차트 */}
        <div style={{ marginTop: 8 }}>
          {points.length > 1 ? (
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
              <path d={areaPath} fill="rgba(37,99,235,0.10)" stroke="none" />
              <path d={linePath} stroke="#2563EB" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>
              시계열 데이터 부족
            </div>
          )}
        </div>

        {/* 가격대 5 그룹 pill */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 5, letterSpacing: 1 }}>
            가격대 (클릭 시 전체 grid 적용)
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {priceBands.map((b) => {
              const active = activePrice === b.band;
              return (
                <button
                  key={b.band}
                  type="button"
                  onClick={() => router.replace(buildHrefBand(b.band, props))}
                  aria-pressed={active}
                  style={{
                    padding: '6px 12px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700,
                    background: active ? 'var(--brand)' : 'var(--bg-hover)',
                    color: active ? 'var(--text-inverse, #fff)' : 'var(--text-secondary)',
                    border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {b.label} <span style={{ opacity: 0.65 }}>({b.site_count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
