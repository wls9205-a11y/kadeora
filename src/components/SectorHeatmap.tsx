'use client';
import { useMemo } from 'react';

interface Stock {
  symbol: string;
  name: string;
  sector?: string;
  market_cap: number;
  change_pct: number;
  price: number;
  currency?: string;
}

function getColor(pct: number, isKR: boolean): string {
  if (pct === 0) return '#374151';
  if (isKR) {
    if (pct >= 3) return 'var(--accent-red)';
    if (pct >= 1) return '#EF4444';
    if (pct > 0) return 'var(--accent-red)';
    if (pct <= -3) return '#1D4ED8';
    if (pct <= -1) return 'var(--brand)';
    return 'var(--accent-blue)';
  }
  if (pct >= 3) return '#059669';
  if (pct >= 1) return '#10B981';
  if (pct > 0) return 'var(--accent-green)';
  if (pct <= -3) return 'var(--accent-red)';
  if (pct <= -1) return '#EF4444';
  return 'var(--accent-red)';
}

export default function SectorHeatmap({ stocks, isKR }: { stocks: Stock[]; isKR: boolean }) {
  const sectors = useMemo(() => {
    const map = new Map<string, { stocks: Stock[]; totalCap: number; avgPct: number }>();
    stocks.filter(s => s.sector && s.market_cap > 0).forEach(s => {
      const sector = s.sector || '기타';
      const cur = map.get(sector) || { stocks: [], totalCap: 0, avgPct: 0 };
      cur.stocks.push(s);
      cur.totalCap += s.market_cap;
      map.set(sector, cur);
    });
    // 평균 등락률 계산
    map.forEach((v) => {
      v.avgPct = v.stocks.reduce((s, st) => s + st.change_pct, 0) / v.stocks.length;
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter(sec => sec.stocks.some(s => s.change_pct !== 0))
      .sort((a, b) => b.totalCap - a.totalCap);
  }, [stocks]);

  const totalCap = sectors.reduce((s, sec) => s + sec.totalCap, 0);

  if (sectors.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-lg)' }}>
      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>🗺️ 섹터 히트맵</div>

      {/* 히트맵 그리드 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 'var(--sp-md)' }}>
        {sectors.map(sec => {
          const widthPct = Math.max(12, (sec.totalCap / totalCap) * 100);
          const topStock = sec.stocks.sort((a, b) => b.market_cap - a.market_cap)[0];
          return (
            <div key={sec.name} style={{
              flex: `0 0 calc(${widthPct}% - 3px)`,
              minWidth: 80, minHeight: 60,
              background: getColor(sec.avgPct, isKR),
              borderRadius: 'var(--radius-sm)', padding: '8px 10px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              cursor: 'default', transition: 'opacity 0.15s',
              opacity: 0.9,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
            >
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-inverse)', lineHeight: 1.2 }}>{sec.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{sec.stocks.length}종목</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-inverse)' }}>
                  {sec.avgPct > 0 ? '+' : ''}{sec.avgPct.toFixed(1)}%
                </span>
                {topStock && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topStock.name}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-md)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: isKR ? 'var(--accent-red)' : '#059669' }} />
          {isKR ? '상승' : 'Up'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#374151' }} />
          보합
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: isKR ? 'var(--brand)' : '#EF4444' }} />
          {isKR ? '하락' : 'Down'}
        </span>
      </div>
    </div>
  );
}
