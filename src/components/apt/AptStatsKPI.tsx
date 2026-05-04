// 서버 — 4 KPI 카드. 각 카드 클릭 시 카테고리 필터로 이동.
import Link from 'next/link';
import type { StatsKPI } from '@/lib/apt-fetcher';

interface Props {
  region: string;
  sigungu: string | null;
  kpis: StatsKPI;
}

interface Card {
  key: 'subscription' | 'unsold' | 'redev' | 'trade';
  label: string;
  emoji: string;
  value: number;
  fromColor: string;
  toColor: string;
}

function buildHref(category: string, region: string, sigungu: string | null): string {
  const p = new URLSearchParams();
  p.set('region', region);
  if (sigungu) p.set('sigungu', sigungu);
  if (category !== 'all') p.set('category', category);
  return `/apt?${p.toString()}`;
}

export default function AptStatsKPI({ region, sigungu, kpis }: Props) {
  const cards: Card[] = [
    { key: 'subscription', label: '분양중',     emoji: '🏗️', value: kpis.active_sub, fromColor: 'rgba(220,38,38,0.10)',  toColor: 'rgba(220,38,38,0.02)' },
    { key: 'unsold',       label: '미분양',     emoji: '📉', value: kpis.unsold,     fromColor: 'rgba(120,113,108,0.10)', toColor: 'rgba(120,113,108,0.02)' },
    { key: 'redev',        label: '재개발',     emoji: '🏚️', value: kpis.redev,      fromColor: 'rgba(139,92,246,0.10)',  toColor: 'rgba(139,92,246,0.02)' },
    { key: 'trade',        label: '7일 실거래', emoji: '📊', value: kpis.trade_7d,   fromColor: 'rgba(5,150,105,0.10)',   toColor: 'rgba(5,150,105,0.02)' },
  ];

  return (
    <section
      aria-label={`${sigungu ?? region} KPI 대시보드`}
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 8,
        }}
      >
        {cards.map((c) => (
          <Link
            key={c.key}
            href={buildHref(c.key, region, sigungu)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '14px 14px',
              background: `linear-gradient(135deg, ${c.fromColor} 0%, ${c.toColor} 100%)`,
              border: '1px solid var(--border)', borderRadius: 12,
              textDecoration: 'none', color: 'inherit',
              transition: 'transform 100ms ease, box-shadow 100ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>{c.label}</span>
              <span aria-hidden style={{ fontSize: 16 }}>{c.emoji}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -1 }}>
                {(c.value || 0).toLocaleString()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>건</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
