'use client';
import { useMemo, useState } from 'react';

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

const COLORS = {
  sub: 'var(--accent-green)',
  ongoing: 'var(--accent-purple)',
  unsold: 'var(--accent-red)',
  redev: 'var(--accent-orange)',
  trade: 'var(--accent-blue)',
};

const LABELS: Record<string, string> = {
  sub: '청약',
  ongoing: '분양',
  unsold: '미분양',
  redev: '재개발',
  trade: '실거래',
};

export default function RegionStackedBar({ apts, ongoingApts, unsold, redevelopment, transactions, onRegionClick, activeRegion, shareButton }: Props) {
  const regions = useMemo(() => {
    const map: Record<string, RegionData> = {};

    const ensure = (name: string) => {
      if (!name || name === '기타') return;
      if (!map[name]) map[name] = { name, sub: 0, ongoing: 0, unsold: 0, redev: 0, trade: 0, total: 0 };
    };

    apts.forEach((a: Record<string, any>) => {
      const r = a.region_nm;
      if (!r) return;
      ensure(r);
      if (map[r]) { map[r].sub++; map[r].total++; }
    });

    ongoingApts.forEach((a: Record<string, any>) => {
      const r = a.region_nm;
      if (!r) return;
      ensure(r);
      if (map[r]) { map[r].ongoing++; map[r].total++; }
    });

    unsold.forEach((u: Record<string, any>) => {
      const r = u.region_nm;
      if (!r) return;
      ensure(r);
      if (map[r]) { map[r].unsold++; map[r].total++; }
    });

    redevelopment.forEach((rd: Record<string, any>) => {
      const r = rd.region || rd.region_nm;
      if (!r) return;
      ensure(r);
      if (map[r]) { map[r].redev++; map[r].total++; }
    });

    const tradeRegionSet: Record<string, Set<string>> = {};
    transactions.forEach((t: Record<string, any>) => {
      const r = t.region_nm || t.sigungu_nm?.slice(0, 2);
      if (!r) return;
      ensure(r);
      if (!tradeRegionSet[r]) tradeRegionSet[r] = new Set();
      tradeRegionSet[r].add(t.apt_name || t.id);
    });
    Object.entries(tradeRegionSet).forEach(([r, s]) => {
      if (map[r]) { map[r].trade = s.size; map[r].total += s.size; }
    });

    return Object.values(map)
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);
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

  const catEntries = [
    { key: 'sub', val: grandCats.sub, color: COLORS.sub },
    { key: 'ongoing', val: grandCats.ongoing, color: COLORS.ongoing },
    { key: 'unsold', val: grandCats.unsold, color: COLORS.unsold },
    { key: 'redev', val: grandCats.redev, color: COLORS.redev },
    { key: 'trade', val: grandCats.trade, color: COLORS.trade },
  ].filter(c => c.val > 0);

  return (
    <div style={{ marginBottom: 8 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>
          지역별 현황
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            총 {grandTotal.toLocaleString()}건
          </span>
          {shareButton}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 10px',
      }}>
        {/* 1줄 합산 바 (유형별 비율) */}
        <div style={{ height: 18, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 4 }}>
          {catEntries.map((cat) => (
            <div
              key={cat.key}
              style={{
                width: `${(cat.val / grandTotal) * 100}%`,
                height: '100%',
                background: cat.color,
                opacity: 0.85,
                minWidth: cat.val > 0 ? 3 : 0,
                transition: 'width 0.3s',
              }}
              title={`${LABELS[cat.key]}: ${cat.val.toLocaleString()}건 (${Math.round((cat.val / grandTotal) * 100)}%)`}
            />
          ))}
        </div>

        {/* 범례 */}
        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}>
          {catEntries.map(cat => (
            <span key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
              {LABELS[cat.key]} {cat.val.toLocaleString()}
            </span>
          ))}
        </div>

        {/* 지역 칩 */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          paddingTop: 6,
          borderTop: '1px solid var(--border)',
        }}>
          {/* 전체 칩 */}
          <button
            onClick={() => onRegionClick?.('전체')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '4px 10px', borderRadius: 16, border: 'none', cursor: 'pointer',
              fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: 'inherit',
              background: !activeRegion ? 'var(--brand)' : 'var(--bg-hover)',
              color: !activeRegion ? 'var(--text-inverse)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            전체 {grandTotal.toLocaleString()}
          </button>

          {/* 지역별 칩 */}
          {regions.map(r => {
            const isActive = activeRegion === r.name;
            return (
              <button
                key={r.name}
                onClick={() => onRegionClick?.(r.name === activeRegion ? '전체' : r.name)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '4px 10px', borderRadius: 16, border: 'none', cursor: 'pointer',
                  fontSize: 'var(--fs-xs)', fontWeight: isActive ? 700 : 500, fontFamily: 'inherit',
                  background: isActive ? 'var(--brand)' : 'var(--bg-hover)',
                  color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                  opacity: activeRegion && !isActive ? 0.6 : 1,
                }}
              >
                {r.name} {r.total.toLocaleString()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
