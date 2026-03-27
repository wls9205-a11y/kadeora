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

  // 선택된 지역 데이터 또는 전체
  const sel = activeRegion ? regions.find(r => r.name === activeRegion) : null;
  const cats = sel ? { sub: sel.sub, ongoing: sel.ongoing, unsold: sel.unsold, redev: sel.redev, trade: sel.trade } : grandCats;
  const total = sel ? sel.total : grandTotal;

  const entries = [
    { key: 'sub', val: cats.sub, color: COLORS.sub },
    { key: 'ongoing', val: cats.ongoing, color: COLORS.ongoing },
    { key: 'unsold', val: cats.unsold, color: COLORS.unsold },
    { key: 'redev', val: cats.redev, color: COLORS.redev },
    { key: 'trade', val: cats.trade, color: COLORS.trade },
  ].filter(c => c.val > 0);

  return (
    <div style={{ marginBottom: 8 }}>
      {/* 헤더: 제목 + 드롭다운 + 공유 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
          <select
            value={activeRegion || '전체'}
            onChange={e => onRegionClick?.(e.target.value)}
            style={{
              padding: '3px 24px 3px 8px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: activeRegion ? 'var(--brand)' : 'var(--text-primary)',
              fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
            }}
          >
            <option value="전체">전체 {grandTotal.toLocaleString()}건</option>
            {regions.map(r => (
              <option key={r.name} value={r.name}>{r.name} {r.total.toLocaleString()}건</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
            {total.toLocaleString()}건
          </span>
          {shareButton}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '8px 10px',
      }}>
        {/* 비율 바 */}
        <div style={{ height: 20, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 6 }}>
          {entries.map(cat => (
            <div key={cat.key} style={{
              width: `${(cat.val / total) * 100}%`, height: '100%',
              background: cat.color, opacity: 0.85,
              minWidth: cat.val > 0 ? 3 : 0, transition: 'width 0.3s',
            }} title={`${LABELS[cat.key]}: ${cat.val.toLocaleString()}건 (${Math.round((cat.val / total) * 100)}%)`} />
          ))}
        </div>

        {/* 범례 + 건수 */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          {entries.map(cat => (
            <span key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
              {LABELS[cat.key]}
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {cat.val.toLocaleString()}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
