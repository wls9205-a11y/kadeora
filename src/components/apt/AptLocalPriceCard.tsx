// 서버 — 시군구(또는 시도) 평당가 + YoY.
import Link from 'next/link';
import type { PriceTrendRow } from '@/lib/apt-fetcher';

interface Props {
  data: PriceTrendRow;
  region: string;
  sigungu: string | null;
}

function fmtPriceMan(v: number | null): string {
  if (!v || v <= 0) return '-';
  if (v >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${v.toLocaleString()}만`;
}

export default function AptLocalPriceCard({ data, region, sigungu }: Props) {
  const yoy = data.yoy_pct;
  const yoyTone = yoy == null ? 'default' : yoy > 0 ? 'success' : yoy < 0 ? 'danger' : 'default';
  const yoyColor = yoyTone === 'success' ? 'var(--accent-red)' : yoyTone === 'danger' ? 'var(--accent-blue)' : 'var(--text-secondary)';
  const region_label = sigungu ? `${region} ${sigungu}` : region;

  return (
    <section
      aria-label="지역 평균가"
      style={{
        maxWidth: 720, margin: '12px auto',
        padding: '12px var(--sp-lg)',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          📈 {region_label} 평균 거래가
        </h2>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{data.stat_month ? `${data.stat_month} 기준` : ''}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
          {fmtPriceMan(data.avg_price)}
        </span>
        {yoy != null && (
          <span style={{ fontSize: 13, fontWeight: 800, color: yoyColor }}>
            YoY {yoy > 0 ? '+' : ''}{yoy.toFixed(1)}%
          </span>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <Link
          href={`/apt/region/${encodeURIComponent(region)}${sigungu ? `/${encodeURIComponent(sigungu)}/subscription` : ''}`}
          style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}
        >
          {region_label} 단지 상세 →
        </Link>
      </div>
    </section>
  );
}
