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
  redevTotalCount?: number;
  tradeTotalCount?: number;
  tradeByRegion?: Record<string, number>;
  redevByRegion?: Record<string, number>;
  subTotalCount?: number;
  unsoldTotalCount?: number;
  ongoingTotalCount?: number;
  dataFreshness?: { sub: string; trade: string; unsold: string; redev: string };
  onRegionClick?: (region: string) => void;
  onTabChange?: (tab: string) => void;
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
  sub: '청약정보',
  ongoing: '분양',
  unsold: '미분양',
  redev: '재개발',
  trade: '실거래(2026)',
};

const CAT_KEYS = ['sub', 'ongoing', 'unsold', 'redev', 'trade'] as const;

export default function RegionStackedBar({ apts, ongoingApts, unsold, redevelopment, transactions, redevTotalCount, tradeTotalCount, tradeByRegion = {}, redevByRegion = {}, subTotalCount, unsoldTotalCount, ongoingTotalCount, dataFreshness, onRegionClick, onTabChange, activeRegion, shareButton }: Props) {
  const regions = useMemo(() => {
    const map: Record<string, RegionData> = {};
    const ensure = (name: string) => {
      if (!name || name === '기타') return;
      if (!map[name]) map[name] = { name, sub: 0, ongoing: 0, unsold: 0, redev: 0, trade: 0, total: 0 };
    };

    const normalizeRegion = (name: string) => name.replace(/특별시|광역시|특별자치시|특별자치도|도$/, '').trim();
    apts.forEach((a: Record<string, any>) => { const r = normalizeRegion(a.region_nm || ''); if (!r) return; ensure(r); if (map[r]) { map[r].sub++; map[r].total++; } });
    ongoingApts.forEach((a: Record<string, any>) => { const r = normalizeRegion(a.region_nm || ''); if (!r) return; ensure(r); if (map[r]) { map[r].ongoing++; map[r].total++; } });
    unsold.forEach((u: Record<string, any>) => { const r = normalizeRegion(u.region_nm || ''); if (!r) return; ensure(r); if (map[r]) { map[r].unsold++; map[r].total++; } });

    // 재개발: 맵 우선, 없으면 배열 순회
    const hasRedevMap = Object.keys(redevByRegion).length > 0;
    if (hasRedevMap) {
      Object.entries(redevByRegion).forEach(([r, count]) => { ensure(r); if (map[r]) { map[r].redev = count; map[r].total += count; } });
    } else {
      redevelopment.forEach((rd: Record<string, any>) => { const r = normalizeRegion(rd.region || rd.region_nm || ''); if (!r) return; ensure(r); if (map[r]) { map[r].redev++; map[r].total++; } });
    }

    // 실거래: 맵 우선, 없으면 배열 순회
    const hasTradeMap = Object.keys(tradeByRegion).length > 0;
    if (hasTradeMap) {
      Object.entries(tradeByRegion).forEach(([r, count]) => { ensure(r); if (map[r]) { map[r].trade = count; map[r].total += count; } });
    } else {
      const tradeRegionSet: Record<string, Set<string>> = {};
      transactions.forEach((t: Record<string, any>) => {
        let r = normalizeRegion(t.region_nm || '');
        if (!r) r = (t.sigungu_nm || '').slice(0, 2);
        if (!r) return; ensure(r);
        if (!tradeRegionSet[r]) tradeRegionSet[r] = new Set();
        tradeRegionSet[r].add(t.apt_name || t.id);
      });
      Object.entries(tradeRegionSet).forEach(([r, s]) => { if (map[r]) { map[r].trade = s.size; map[r].total += s.size; } });
    }

    return Object.values(map).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  }, [apts, ongoingApts, unsold, redevelopment, transactions, tradeByRegion, redevByRegion]);

  const grandTotal = regions.reduce((s: number, r: RegionData) => s + r.total, 0);
  const grandCats = {
    sub: subTotalCount || regions.reduce((s: number, r: RegionData) => s + r.sub, 0),
    ongoing: ongoingTotalCount || regions.reduce((s: number, r: RegionData) => s + r.ongoing, 0),
    unsold: unsoldTotalCount || regions.reduce((s: number, r: RegionData) => s + r.unsold, 0),
    redev: redevTotalCount || regions.reduce((s: number, r: RegionData) => s + r.redev, 0),
    trade: tradeTotalCount || regions.reduce((s: number, r: RegionData) => s + r.trade, 0),
  };

  if (regions.length === 0) return null;

  const sel = activeRegion ? regions.find(r => r.name === activeRegion) : null;
  const cats = sel ? { sub: sel.sub, ongoing: sel.ongoing, unsold: sel.unsold, redev: sel.redev, trade: sel.trade } : grandCats;
  const total = sel ? sel.total : grandTotal;

  // All 5 categories for legend (even if 0), filtered for arcs
  const allEntries = CAT_KEYS.map(key => ({ key, val: cats[key], color: COLORS[key] }));
  const entries = allEntries.filter(c => c.val > 0);

  // Donut geometry (mini — 72×72)
  const R = 26;
  const CIRC = 2 * Math.PI * R;

  let offset = 0;
  const arcs = entries.map(e => {
    const len = total > 0 ? (e.val / total) * CIRC : 0;
    const arc = { ...e, dasharray: `${len} ${CIRC - len}`, dashoffset: -offset };
    offset += len;
    return arc;
  });

  return (
    <div style={{ marginBottom: 8, maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
        {shareButton}
      </div>

      {/* V2-A: Mini donut + 2×3 interactive card grid */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '10px 10px', marginBottom: 6,
        overflow: 'hidden',
      }}>
        {/* Mini donut */}
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <svg width={72} height={72} viewBox="0 0 72 72">
            <circle cx={36} cy={36} r={R} fill="none" stroke="var(--border)" strokeWidth={10} opacity={0.2} />
            <g transform="rotate(-90 36 36)">
              {arcs.map(a => (
                <circle key={a.key} cx={36} cy={36} r={R} fill="none" stroke={a.color} strokeWidth={10} strokeDasharray={a.dasharray} strokeDashoffset={a.dashoffset} strokeLinecap="butt" style={{ transition: 'stroke-dasharray 0.3s' }} />
              ))}
            </g>
            <text x={36} y={33} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text-tertiary)' }}>{sel ? sel.name : '전체'}</text>
            <text x={36} y={44} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--text-primary)' }}>{total.toLocaleString()}</text>
          </svg>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>{dataFreshness?.sub ? `${dataFreshness.sub.split(' ').slice(0, 2).join(' ')} 수집` : ''}</div>
        </div>
        {/* 2×3 card grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, minWidth: 0 }}>
          {(() => {
            const today = new Date().toISOString().slice(0, 10);
            const openCount = apts.filter((a: any) => a.rcept_bgnde <= today && a.rcept_endde >= today).length;
            const upcomingCount = apts.filter((a: any) => a.rcept_bgnde > today).length;
            const unsoldUnits = (unsold as any[]).reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
            const redevTop = Object.entries(redevByRegion).sort((a, b) => b[1] - a[1]).slice(0, 2);
            const tradeAvg = transactions.length > 0 ? Math.round((transactions as any[]).reduce((s: number, t: any) => s + (Number(t.deal_amount) || 0), 0) / transactions.length) : 0;
            const tradeMax = transactions.length > 0 ? Math.max(...(transactions as any[]).map((t: any) => Number(t.deal_amount) || 0)) : 0;
            const fmtA = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : n > 0 ? `${n.toLocaleString()}만` : '-';

            const cards = [
              { key: 'sub', tab: 'sub', label: '청약정보', value: cats.sub, color: COLORS.sub, tags: [
                ...(openCount > 0 ? [{ text: `접수 ${openCount}`, bg: 'rgba(59,155,107,0.12)', color: '#3B9B6B' }] : []),
                ...(upcomingCount > 0 ? [{ text: `예정 ${upcomingCount}`, bg: 'rgba(96,165,250,0.1)', color: '#60A5FA' }] : []),
              ]},
              { key: 'ongoing', tab: 'ongoing', label: '분양중', value: cats.ongoing, color: COLORS.ongoing, tags: [
                { text: '입주전 현장', bg: 'rgba(127,119,221,0.08)', color: '#7F77DD' },
              ]},
              { key: 'unsold', tab: 'unsold', label: '미분양', value: cats.unsold, color: COLORS.unsold, tags: [
                ...(unsoldUnits > 0 ? [{ text: `${unsoldUnits.toLocaleString()}세대`, bg: 'rgba(226,75,74,0.12)', color: '#E24B4A' }] : []),
              ]},
              { key: 'redev', tab: 'redev', label: '재개발', value: cats.redev, color: COLORS.redev, tags: redevTop.map(([r, c]) => ({ text: `${r} ${c}`, bg: 'rgba(216,90,48,0.08)', color: '#D85A30' })) },
              { key: 'trade', tab: 'trade', label: '실거래(2026)', value: cats.trade, color: COLORS.trade, tags: [
                ...(tradeAvg > 0 ? [{ text: `평균 ${fmtA(tradeAvg)}`, bg: 'rgba(55,138,221,0.1)', color: '#378ADD' }] : []),
                ...(tradeMax > 0 ? [{ text: `최고 ${fmtA(tradeMax)}`, bg: 'rgba(55,138,221,0.06)', color: '#378ADD' }] : []),
              ]},
              { key: 'complex', tab: null, label: '단지백과', value: 34495, color: 'var(--text-tertiary)', tags: [
                { text: '매매 49.7만', bg: 'var(--bg-hover)', color: 'var(--text-secondary)' },
                { text: '전월세 209만', bg: 'var(--bg-hover)', color: 'var(--text-secondary)' },
              ]},
            ];

            return cards.map(c => (
              <div key={c.key} onClick={() => {
                if (c.tab && onTabChange) onTabChange(c.tab);
                else if (c.key === 'complex') window.location.href = '/apt/complex';
              }} style={{
                padding: '6px 6px', borderRadius: 6, borderLeft: `2px solid ${c.color}`,
                cursor: 'pointer', transition: 'background 0.15s',
              }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{c.value.toLocaleString()}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2 }}>{c.label}</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {c.tags.map((t, i) => (
                    <span key={i} style={{ fontSize: 9, padding: '0px 4px', borderRadius: 3, background: t.bg, color: t.color, fontWeight: 500 }}>{t.text}</span>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Compact tile grid — 모바일 3열 / 데스크탑 5열 */}
      <div className="grid grid-cols-3 md:grid-cols-5" style={{
        gap: 5,
        maxWidth: '100%',
        overflow: 'hidden',
      }}>
        {regions.map((r) => {
          const isActive = activeRegion === r.name;
          return (
            <button
              key={r.name}
              onClick={() => onRegionClick?.(isActive ? '전체' : r.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 8px',
                background: isActive ? 'var(--brand-bg, rgba(37,99,235,0.06))' : 'var(--bg-surface)',
                border: isActive ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                borderRadius: 7,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                width: '100%',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Name + mini bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--brand)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? 'var(--brand)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {r.total.toLocaleString()}
                  </span>
                </div>
                {/* Mini stacked bar */}
                <div style={{ display: 'flex', width: '100%', height: 3, borderRadius: 1.5, overflow: 'hidden', marginTop: 2 }}>
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
