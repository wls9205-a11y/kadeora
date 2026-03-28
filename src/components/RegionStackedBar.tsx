'use client';
import { useMemo } from 'react';

interface RegionData {
  name: string;
  sub: number;
  ongoing: number;
  unsold: number;
  redev: number;
  trade: number;
  total: number;
}

interface Props {
  apts: Record<string, any>[];
  ongoingApts: Record<string, any>[];
  unsold: Record<string, any>[];
  redevelopment: Record<string, any>[];
  transactions: Record<string, any>[];
  onRegionClick?: (region: string) => void;
  activeRegion?: string;
  shareButton?: React.ReactNode;
}

const COLORS: Record<string, string> = {
  sub: '#3B9B6B',
  ongoing: '#7F77DD',
  unsold: '#E24B4A',
  redev: '#D85A30',
  trade: '#378ADD',
};

const LABELS: Record<string, string> = {
  sub: '청약',
  ongoing: '분양',
  unsold: '미분양',
  redev: '재개발',
  trade: '실거래',
};

const CAT_KEYS = ['sub', 'ongoing', 'unsold', 'redev', 'trade'] as const;

export default function RegionStackedBar({ apts, ongoingApts, unsold, redevelopment, transactions, onRegionClick, activeRegion, shareButton }: Props) {
  const regions = useMemo(() => {
    const map: Record<string, RegionData> = {};
    const ensure = (name: string) => {
      if (!name || name === '기타') return;
      if (!map[name]) map[name] = { name, sub: 0, ongoing: 0, unsold: 0, redev: 0, trade: 0, total: 0 };
    };

    apts.forEach((a: Record<string, any>) => { const r = a.region_nm; if (!r) return; ensure(r); if (map[r]) { map[r].sub++; map[r].total++; } });
    ongoingApts.forEach((a: Record<string, any>) => { const r = a.region_nm; if (!r) return; ensure(r); if (map[r]) { map[r].ongoing++; map[r].total++; } });
    unsold.forEach((u: Record<string, any>) => { const r = u.region_nm; if (!r) return; ensure(r); if (map[r]) { map[r].unsold++; map[r].total++; } });
    redevelopment.forEach((rd: Record<string, any>) => { const r = rd.region || rd.region_nm; if (!r) return; ensure(r); if (map[r]) { map[r].redev++; map[r].total++; } });

    const tradeRegionSet: Record<string, Set<string>> = {};
    transactions.forEach((t: Record<string, any>) => {
      const r = t.region_nm || t.sigungu_nm?.slice(0, 2);
      if (!r) return; ensure(r);
      if (!tradeRegionSet[r]) tradeRegionSet[r] = new Set();
      tradeRegionSet[r].add(t.apt_name || t.id);
    });
    Object.entries(tradeRegionSet).forEach(([r, s]) => { if (map[r]) { map[r].trade = s.size; map[r].total += s.size; } });

    return Object.values(map).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  }, [apts, ongoingApts, unsold, redevelopment, transactions]);

  const grandTotal = regions.reduce((s, r) => s + r.total, 0);
  const grandCats = {
    sub: regions.reduce((s, r) => s + r.sub, 0),
    ongoing: regions.reduce((s, r) => s + r.ongoing, 0),
    unsold: regions.reduce((s, r) => s + r.unsold, 0),
    redev: regions.reduce((s, r) => s + r.redev, 0),
    trade: regions.reduce((s, r) => s + r.trade, 0),
  };

  if (regions.length === 0) return null;

  const sel = activeRegion ? regions.find(r => r.name === activeRegion) : null;
  const cats = sel ? { sub: sel.sub, ongoing: sel.ongoing, unsold: sel.unsold, redev: sel.redev, trade: sel.trade } : grandCats;
  const total = sel ? sel.total : grandTotal;

  const entries = CAT_KEYS
    .map(key => ({ key, val: cats[key], color: COLORS[key] }))
    .filter(c => c.val > 0);

  // Donut geometry
  const R = 42;
  const CIRC = 2 * Math.PI * R;

  let offset = 0;
  const arcs = entries.map(e => {
    const len = total > 0 ? (e.val / total) * CIRC : 0;
    const arc = { ...e, dasharray: `${len} ${CIRC - len}`, dashoffset: -offset };
    offset += len;
    return arc;
  });

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
        {shareButton}
      </div>

      {/* Donut + Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6,
      }}>
        {/* Donut chart */}
        <svg width={110} height={110} viewBox="0 0 110 110" style={{ flexShrink: 0 }}>
          {/* Background ring */}
          <circle cx={55} cy={55} r={R} fill="none" stroke="var(--border)" strokeWidth={16} opacity={0.4} />
          {/* Category arcs */}
          <g transform="rotate(-90 55 55)">
            {arcs.map(a => (
              <circle
                key={a.key}
                cx={55}
                cy={55}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={16}
                strokeDasharray={a.dasharray}
                strokeDashoffset={a.dashoffset}
                strokeLinecap="butt"
                style={{ transition: 'stroke-dasharray 0.3s, stroke-dashoffset 0.3s' }}
              />
            ))}
          </g>
          {/* Center text */}
          {sel ? (
            <>
              <text x={55} y={50} textAnchor="middle" dominantBaseline="auto" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-secondary)' }}>
                {sel.name}
              </text>
              <text x={55} y={66} textAnchor="middle" dominantBaseline="auto" style={{ fontSize: 14, fontWeight: 700, fill: 'var(--text-primary)' }}>
                {total.toLocaleString()}
              </text>
            </>
          ) : (
            <text x={55} y={60} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 15, fontWeight: 700, fill: 'var(--text-primary)' }}>
              {total.toLocaleString()}
            </text>
          )}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 80 }}>
          {entries.map(e => (
            <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-tertiary)' }}>{LABELS[e.key]}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
                {e.val.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Compact tile grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 6,
      }}>
        {regions.map((r, i) => {
          const isActive = activeRegion === r.name;
          return (
            <button
              key={r.name}
              onClick={() => onRegionClick?.(isActive ? '전체' : r.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px',
                background: 'var(--bg-surface)',
                border: isActive ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                width: '100%',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Rank */}
              <span style={{
                fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                width: 16, textAlign: 'center', flexShrink: 0,
              }}>
                {i + 1}
              </span>

              {/* Name + mini bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {r.total.toLocaleString()}
                  </span>
                </div>
                {/* Mini stacked bar */}
                <div style={{ display: 'flex', width: 40, height: 3, borderRadius: 1.5, overflow: 'hidden', marginTop: 2 }}>
                  {CAT_KEYS.map(k => {
                    const v = r[k];
                    if (v <= 0) return null;
                    return (
                      <div
                        key={k}
                        style={{
                          width: `${(v / r.total) * 100}%`,
                          height: '100%',
                          background: COLORS[k],
                          minWidth: v > 0 ? 1 : 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
