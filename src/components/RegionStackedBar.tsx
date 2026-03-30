'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

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
  redevRedevCount?: number;
  redevRebuildCount?: number;
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

export default function RegionStackedBar({ apts, ongoingApts, unsold, redevelopment, transactions, redevTotalCount, tradeTotalCount, tradeByRegion = {}, redevByRegion = {}, subTotalCount, unsoldTotalCount, ongoingTotalCount, dataFreshness, onRegionClick, onTabChange, activeRegion, redevRedevCount = 0, redevRebuildCount = 0, shareButton }: Props) {
  const router = useRouter();
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

  const sel = activeRegion ? regions.find((r: RegionData) => r.name === activeRegion) : null;
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

      {/* B-2: Mini donut + 2×4 interactive card grid with progress bars */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '10px 8px', marginBottom: 6,
        overflow: 'hidden',
      }}>
        {/* Mini donut */}
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            <circle cx={32} cy={32} r={R} fill="none" stroke="var(--border)" strokeWidth={9} opacity={0.2} />
            <g transform="rotate(-90 32 32)">
              {arcs.map(a => (
                <circle key={a.key} cx={32} cy={32} r={R} fill="none" stroke={a.color} strokeWidth={9} strokeDasharray={a.dasharray} strokeDashoffset={a.dashoffset} strokeLinecap="butt" style={{ transition: 'stroke-dasharray 0.3s' }} />
              ))}
            </g>
            <text x={32} y={29} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text-tertiary)' }}>{sel ? sel.name : '전체'}</text>
            <text x={32} y={39} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--text-primary)' }}>{total.toLocaleString()}</text>
          </svg>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>{dataFreshness?.sub ? `${dataFreshness.sub.split(' ').slice(0, 2).join(' ')} 수집` : ''}</div>
        </div>
        {/* 2×4 card grid — 모바일에서도 4열 유지하되 gap 줄임 */}
        <div className="donut-card-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 3, minWidth: 0 }}>
          {(() => {
            const today = new Date().toISOString().slice(0, 10);
            const openCount = apts.filter((a: any) => a.rcept_bgnde <= today && a.rcept_endde >= today).length;
            const upcomingCount = apts.filter((a: any) => a.rcept_bgnde > today).length;
            const closedCount = apts.filter((a: any) => a.rcept_endde < today).length;
            const unsoldUnits = (unsold as any[]).reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
            const tradeAvg = transactions.length > 0 ? Math.round((transactions as any[]).reduce((s: number, t: any) => s + (Number(t.deal_amount) || 0), 0) / transactions.length) : 0;
            const tradeMax = transactions.length > 0 ? Math.max(...(transactions as any[]).map((t: any) => Number(t.deal_amount) || 0)) : 0;
            const fmtA = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : n > 0 ? `${n.toLocaleString()}만` : '-';
            // 재개발/재건축 분리 카운트 — SSR에서 전달받은 값 사용
            const redevCount = redevRedevCount || (redevelopment as any[]).filter((r: any) => (r.project_type || '').includes('재개발')).length;
            const rebuildCount = redevRebuildCount || (redevelopment as any[]).filter((r: any) => (r.project_type || '').includes('재건축')).length;
            // 분양중: 최근 입주 시공사
            const ongoingUnits = (ongoingApts as any[]).reduce((s: number, a: any) => s + (Number(a.tot_supply_hshld_co) || 0), 0);
            const maxVal = Math.max(cats.sub, cats.ongoing, cats.unsold, cats.redev, cats.trade, 34495, 5522);

            const cardStyle = (color: string) => ({
              padding: '5px 5px', borderLeft: `2px solid ${color}`, borderRadius: 0 as const, cursor: 'pointer' as const, transition: 'background 0.12s',
            });
            const barStyle = (pct: number, color: string) => (
              <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(pct, 1)}%`, background: color, borderRadius: 2 }} />
              </div>
            );
            const hoverIn = (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'var(--bg-hover)');
            const hoverOut = (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'transparent');

            return <>
              {/* 청약정보 */}
              <div style={cardStyle(COLORS.sub)} onClick={() => onTabChange?.('sub')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cats.sub.toLocaleString()}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>청약정보</div>
                {barStyle(Math.round(cats.sub / maxVal * 100), COLORS.sub)}
                <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
                  {openCount > 0 && <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(59,155,107,0.1)', color: '#3B9B6B', fontWeight: 500 }}>접수 {openCount}</span>}
                  {upcomingCount > 0 && <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(96,165,250,0.08)', color: '#60A5FA', fontWeight: 500 }}>예정 {upcomingCount}</span>}
                  {closedCount > 0 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500 }}>마감 {closedCount}</span>}
                </div>
              </div>
              {/* 분양중 */}
              <div style={cardStyle(COLORS.ongoing)} onClick={() => onTabChange?.('ongoing')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cats.ongoing.toLocaleString()}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>분양중</div>
                {barStyle(Math.round(cats.ongoing / maxVal * 100), COLORS.ongoing)}
                <div style={{ marginTop: 2 }}><span style={{ fontSize: 9, color: COLORS.ongoing }}>{ongoingUnits > 0 ? `${ongoingUnits.toLocaleString()}세대` : '입주전 현장'}</span></div>
              </div>
              {/* 미분양 */}
              <div style={cardStyle(COLORS.unsold)} onClick={() => onTabChange?.('unsold')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cats.unsold.toLocaleString()}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>미분양</div>
                {barStyle(Math.round(cats.unsold / maxVal * 100), COLORS.unsold)}
                {unsoldUnits > 0 && <div style={{ marginTop: 2 }}><span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(226,75,74,0.1)', color: '#E24B4A', fontWeight: 500 }}>{unsoldUnits.toLocaleString()}세대</span></div>}
              </div>
              {/* 재개발·재건축 */}
              <div style={cardStyle(COLORS.redev)} onClick={() => onTabChange?.('redev')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cats.redev.toLocaleString()}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>재개발·재건축</div>
                {barStyle(Math.round(cats.redev / maxVal * 100), COLORS.redev)}
                <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
                  {redevCount > 0 && <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(216,90,48,0.08)', color: '#D85A30', fontWeight: 500 }}>재개발 {redevCount}</span>}
                  {rebuildCount > 0 && <span style={{ fontSize: 9, color: '#D85A30', fontWeight: 500 }}>재건축 {rebuildCount}</span>}
                </div>
              </div>
              {/* 실거래(2026) */}
              <div style={cardStyle(COLORS.trade)} onClick={() => onTabChange?.('trade')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cats.trade.toLocaleString()}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>실거래(2026)</div>
                {barStyle(Math.round(cats.trade / maxVal * 100), COLORS.trade)}
                <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
                  {tradeAvg > 0 && <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(55,138,221,0.08)', color: '#378ADD', fontWeight: 500 }}>평균 {fmtA(tradeAvg)}</span>}
                  {tradeMax > 0 && <span style={{ fontSize: 9, color: '#378ADD', fontWeight: 500 }}>최고 {fmtA(tradeMax)}</span>}
                </div>
              </div>
              {/* 단지백과 */}
              <div style={{ ...cardStyle('var(--border)'), borderLeftColor: 'var(--border)' }} onClick={() => { router.push('/apt/complex'); }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>34,495</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>단지백과</div>
                {barStyle(100, 'var(--border)')}
                <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>매매 49.7만</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>전월세 209만</span>
                </div>
              </div>
              {/* 분양사이트 */}
              <div style={cardStyle('#22D3EE')} onClick={() => { router.push('/apt/sites'); }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#22D3EE', fontVariantNumeric: 'tabular-nums' }}>5,522</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>분양사이트</div>
                {barStyle(Math.round(5522 / maxVal * 100), '#22D3EE')}
                <div style={{ marginTop: 2 }}><span style={{ fontSize: 9, color: '#22D3EE', fontWeight: 500 }}>전국 현장</span></div>
              </div>
              {/* 부동산 지도 */}
              <div style={cardStyle('#FBB724')} onClick={() => { router.push('/apt/map'); }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#BA7517', fontVariantNumeric: 'tabular-nums' }}>지도</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>→</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>부동산 지도</div>
                {barStyle(Math.round(regions.length / 17 * 100), '#FBB724')}
                <div style={{ marginTop: 2 }}><span style={{ fontSize: 9, color: '#BA7517', fontWeight: 500 }}>17개 지역</span></div>
              </div>
            </>;
          })()}
        </div>
      </div>

      {/* Compact tile grid — 모바일 3열 / 데스크탑 5열 */}
      <div className="grid grid-cols-4 md:grid-cols-5" style={{
        gap: 5,
        maxWidth: '100%',
        overflow: 'hidden',
      }}>
        {regions.map((r: RegionData) => {
          const isActive = activeRegion === r.name;
          return (
            <button
              key={r.name}
              onClick={() => onRegionClick?.(isActive ? '전체' : r.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 6px',
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--brand)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--brand)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {r.total.toLocaleString()}
                  </span>
                </div>
                {/* Single progress bar */}
                <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((r.total / (regions[0]?.total || 1)) * 100)}%`, background: isActive ? 'var(--brand)' : 'var(--brand-dim, rgba(59,123,246,0.4))', borderRadius: 2 }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
