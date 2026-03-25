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
  apts: any[];
  ongoingApts: any[];
  unsold: any[];
  redevelopment: any[];
  transactions: any[];
  onRegionClick?: (region: string) => void;
  activeRegion?: string;
}

const COLORS = {
  sub: 'var(--accent-green)',
  ongoing: 'var(--accent-purple)',
  unsold: 'var(--accent-red)',
  redev: 'var(--accent-orange)',
  trade: 'var(--accent-blue)',
};

const LABELS = {
  sub: '청약',
  ongoing: '분양',
  unsold: '미분양',
  redev: '재개발',
  trade: '실거래',
};

export default function RegionStackedBar({ apts, ongoingApts, unsold, redevelopment, transactions, onRegionClick, activeRegion }: Props) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const regions = useMemo(() => {
    const map: Record<string, RegionData> = {};

    const ensure = (name: string) => {
      if (!name || name === '기타') return;
      if (!map[name]) map[name] = { name, sub: 0, ongoing: 0, unsold: 0, redev: 0, trade: 0, total: 0 };
    };

    // 청약
    apts.forEach((a: any) => {
      const r = a.region_nm;
      if (!r) return;
      ensure(r);
      if (map[r]) { map[r].sub++; map[r].total++; }
    });

    // 분양중
    ongoingApts.forEach((a: any) => {
      const r = a.region_nm;
      if (!r) return;
      ensure(r);
      if (map[r]) { map[r].ongoing++; map[r].total++; }
    });

    // 미분양
    unsold.forEach((u: any) => {
      const r = u.region_nm;
      if (!r) return;
      ensure(r);
      if (map[r]) { map[r].unsold++; map[r].total++; }
    });

    // 재개발
    redevelopment.forEach((rd: any) => {
      const r = rd.region || rd.region_nm;
      if (!r) return;
      ensure(r);
      if (map[r]) { map[r].redev++; map[r].total++; }
    });

    // 실거래 (지역별 고유 거래 수)
    const tradeRegionSet: Record<string, Set<string>> = {};
    transactions.forEach((t: any) => {
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
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [apts, ongoingApts, unsold, redevelopment, transactions]);

  const maxTotal = Math.max(...regions.map(r => r.total), 1);
  const grandTotal = regions.reduce((s, r) => s + r.total, 0);
  const grandCats = {
    sub: regions.reduce((s, r) => s + r.sub, 0),
    ongoing: regions.reduce((s, r) => s + r.ongoing, 0),
    unsold: regions.reduce((s, r) => s + r.unsold, 0),
    redev: regions.reduce((s, r) => s + r.redev, 0),
    trade: regions.reduce((s, r) => s + r.trade, 0),
  };

  if (regions.length === 0) return null;

  const renderRow = (r: RegionData, isAll: boolean = false) => {
    const isActive = isAll ? !activeRegion : activeRegion === r.name;
    const isHover = hoveredRegion === (isAll ? '__all__' : r.name);
    const isDimmed = activeRegion && !isActive;
    const cats = [
      { key: 'sub', val: r.sub, color: COLORS.sub },
      { key: 'ongoing', val: r.ongoing, color: COLORS.ongoing },
      { key: 'unsold', val: r.unsold, color: COLORS.unsold },
      { key: 'redev', val: r.redev, color: COLORS.redev },
      { key: 'trade', val: r.trade, color: COLORS.trade },
    ].filter(c => c.val > 0);

    return (
      <div
        key={isAll ? '__all__' : r.name}
        onClick={() => onRegionClick?.(isAll ? '전체' : (r.name === activeRegion ? '전체' : r.name))}
        onMouseEnter={() => setHoveredRegion(isAll ? '__all__' : r.name)}
        onMouseLeave={() => setHoveredRegion(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 0',
          cursor: onRegionClick ? 'pointer' : 'default',
          opacity: isDimmed ? 0.35 : 1,
          transition: 'opacity 0.15s',
          ...(isAll ? { borderBottom: '1px solid var(--border)', marginBottom: 4, paddingBottom: 7 } : {}),
        }}
      >
        <div style={{
          width: 32,
          fontSize: 'var(--fs-xs)',
          fontWeight: isActive ? 800 : 600,
          color: isActive ? 'var(--brand)' : 'var(--text-primary)',
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {isAll ? '전체' : r.name}
        </div>

        <div style={{
          flex: 1,
          height: isAll ? 22 : 20,
          borderRadius: 4,
          background: 'var(--bg-elevated)',
          overflow: 'hidden',
          display: 'flex',
          border: isActive ? '1px solid var(--brand-border)' : (isHover ? '1px solid var(--border-strong)' : '1px solid transparent'),
          transition: 'border-color 0.12s',
        }}>
          {cats.map((cat) => (
            <div
              key={cat.key}
              style={{
                width: `${(cat.val / (isAll ? grandTotal : maxTotal)) * 100}%`,
                height: '100%',
                background: cat.color,
                opacity: isHover ? 1 : 0.85,
                transition: 'opacity 0.12s',
                minWidth: cat.val > 0 ? 3 : 0,
              }}
            />
          ))}
        </div>

        <div style={{
          width: 26,
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {r.total}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>
          지역별 현황
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          총 {regions.reduce((s, r) => s + r.total, 0)}건
        </span>
      </div>

      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
      }}>
        {/* 전체 행 */}
        {renderRow({ name: '전체', ...grandCats, total: grandTotal }, true)}

        {/* 지역별 행 */}
        {regions.map((r) => renderRow(r))}

        {/* 범례 */}
        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-tertiary)',
        }}>
          {Object.entries(LABELS).map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 2,
                background: COLORS[key as keyof typeof COLORS],
                flexShrink: 0,
              }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
