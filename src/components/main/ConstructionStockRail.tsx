/**
 * ConstructionStockRail — 건설주 ↔ 매핑 단지 (server).
 * 가로 스크롤. 각 카드: 종목 정보 + sparkline + 매핑 단지 chip.
 */
import Link from 'next/link';
import type { MainConstructionStock } from './types';

interface Props {
  items: MainConstructionStock[];
}

function Sparkline({ data, color, width = 180, height = 40 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function ConstructionStockRail({ items }: Props) {
  return (
    <section style={{ padding: 16, background: 'var(--bg-base)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>건설주 ↔ 단지</h2>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center', border: '0.5px solid var(--border)', borderRadius: 8 }}>
          건설주 데이터 없음
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {items.map((s) => {
            const up = s.change_pct >= 0;
            const color = up ? 'var(--accent-green, #22c55e)' : '#ef4444';
            return (
              <div
                key={s.symbol}
                style={{
                  flex: '0 0 auto', width: 200, padding: 10,
                  border: '0.5px solid var(--border)', borderRadius: 10,
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.symbol}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                    {up ? '+' : ''}{s.change_pct.toFixed(2)}%
                  </span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Sparkline data={s.sparkline} color={color} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {s.related_apts.slice(0, 2).map((apt) => (
                    <Link
                      key={apt.id}
                      href={`/apt/${apt.slug}`}
                      style={{
                        fontSize: 11, padding: '2px 6px', borderRadius: 4,
                        background: 'var(--bg-hover, rgba(255,255,255,0.04))',
                        color: 'var(--text-secondary)', textDecoration: 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80,
                      }}
                    >
                      {apt.name}
                    </Link>
                  ))}
                  {s.related_apts.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>매핑 단지 없음</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
