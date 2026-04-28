// 서버 — 최근 실거래 10건 list (단지명/지역/날짜/거래가/평당가/면적/층).
import Link from 'next/link';
import type { RecentTradeRow } from '@/lib/apt-fetcher';

interface Props {
  region: string;
  sigungu: string | null;
  trades: RecentTradeRow[];
}

function fmtAmount(v: number | null): string {
  if (!v || v <= 0) return '-';
  if (v >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${Math.round(v).toLocaleString()}만`;
}

function fmtArea(m2: number | null): string {
  if (!m2 || m2 <= 0) return '-';
  // m² + 평
  const py = Math.round(m2 / 3.305);
  return `${m2.toFixed(1)}㎡ · ${py}평`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  return s.slice(0, 10);
}

export default function AptRecentTradeList({ region, sigungu, trades }: Props) {
  if (!trades || trades.length === 0) return null;
  const label = sigungu ? `${region} ${sigungu}` : region;

  return (
    <section
      aria-label="최근 실거래"
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        📊 {label} 최근 실거래 <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>· {trades.length}건</span>
      </h2>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
        overflow: 'hidden',
      }}>
        {trades.map((t, i) => (
          <Link
            key={`${t.id}-${i}`}
            href={`/apt/complex/${encodeURIComponent(t.apt_name)}`}
            style={{
              display: 'grid', gap: 6,
              gridTemplateColumns: '1fr auto',
              padding: '11px 14px',
              borderBottom: i < trades.length - 1 ? '1px solid var(--border)' : 'none',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.apt_name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {[t.dong || t.sigungu || '', fmtArea(t.exclusive_area), t.floor ? `${t.floor}층` : null].filter(Boolean).join(' · ')}
                {t.built_year && <span> · {t.built_year}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                {fmtAmount(t.deal_amount)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {t.price_per_pyeong ? `평당 ${t.price_per_pyeong.toLocaleString()}만` : ''}
                {t.deal_date && <span> · {fmtDate(t.deal_date)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
