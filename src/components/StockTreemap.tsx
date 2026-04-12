'use client';
import { stockUpHex, stockDownHex } from '@/lib/stockColor';
import { useState, useMemo } from 'react';
import Link from 'next/link';

interface Stock { symbol: string; name: string; market: string; price: number; change_pct: number | null; market_cap: number; sector?: string | null; currency?: string; }
interface Props { stocks: Stock[]; isKR: boolean; }

interface SectorBlock {
  name: string; avg: number; total: number; count: number;
  symbols: { symbol: string; name: string; pct: number; cap: number }[];
}

export default function StockTreemap({ stocks, isKR }: Props) {
  const [selected, setSelected] = useState<SectorBlock | null>(null);

  const sectors = useMemo<SectorBlock[]>(() => {
    const map: Record<string, { sum: number; count: number; total: number; stocks: { symbol: string; name: string; pct: number; cap: number }[] }> = {};
    stocks.filter(s => s.price > 0 && s.market_cap > 0 && s.sector).forEach(s => {
      const sec = s.sector!;
      if (!map[sec]) map[sec] = { sum: 0, count: 0, total: 0, stocks: [] };
      map[sec].sum += s.change_pct ?? 0;
      map[sec].count++;
      map[sec].total += s.market_cap;
      map[sec].stocks.push({ symbol: s.symbol, name: s.name, pct: s.change_pct ?? 0, cap: s.market_cap });
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, avg: v.sum / v.count, total: v.total, count: v.count, symbols: v.stocks.sort((a, b) => b.cap - a.cap).slice(0, 5) }))
      .filter(s => s.count >= 1)
      .sort((a, b) => b.total - a.total)
      .slice(0, 14);
  }, [stocks]);

  const maxTotal = Math.max(...sectors.map(s => s.total), 1);
  const upC = stockUpHex(isKR);
  const dnC = stockDownHex(isKR);

  const cellColor = (avg: number) => {
    if (Math.abs(avg) < 0.2) return { bg: '#1A2540', border: '#1A2540' };
    const intensity = Math.min(Math.abs(avg) / 5, 1);
    const alpha = 0.18 + intensity * 0.55;
    if (avg > 0) return { bg: `rgba(${isKR ? '255,107,107' : '46,232,165'},${alpha})`, border: `rgba(${isKR ? '255,107,107' : '46,232,165'},0.3)` };
    return { bg: `rgba(${isKR ? '108,180,255' : '255,107,107'},${alpha})`, border: `rgba(${isKR ? '108,180,255' : '255,107,107'},0.3)` };
  };

  const fmtCap = (v: number) => v >= 1e13 ? `${(v/1e12).toFixed(0)}조` : v >= 1e12 ? `${(v/1e12).toFixed(1)}조` : `${(v/1e8).toFixed(0)}억`;

  return (
    <div style={{ marginBottom: 'var(--sp-md)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 'var(--sp-sm)' }}>
        시총 트리맵 · 크기=시총 · 색상=등락
      </div>

      {/* 트리맵 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridAutoRows: '24px', gap: 4, marginBottom: 'var(--sp-sm)' }}>
        {sectors.map((sec, i) => {
          const capRatio = sec.total / maxTotal;
          const cs = Math.max(2, Math.round(capRatio * 10));
          const rs = Math.max(2, Math.round(capRatio * 7));
          const { bg, border } = cellColor(sec.avg);
          const col = isKR ? (sec.avg > 0 ? upC : dnC) : (sec.avg > 0 ? upC : dnC);
          const isSelected = selected?.name === sec.name;

          return (
            <button key={sec.name} onClick={() => setSelected(isSelected ? null : sec)} style={{
              gridColumn: `span ${Math.min(cs, 12)}`, gridRow: `span ${Math.min(rs, 5)}`,
              background: bg, border: `1px solid ${isSelected ? col : border}`,
              borderRadius: 'var(--radius-xs)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 1, overflow: 'hidden',
              transition: 'all var(--transition-fast)', padding: 4,
              boxShadow: isSelected ? `0 0 0 2px ${col}60` : 'none',
            }}>
              {cs >= 2 && rs >= 2 && <span style={{ fontSize: Math.min(10, 7 + cs), fontWeight: 700, color: '#E0EAFF', lineHeight: 1.1, textAlign: 'center' }}>{sec.name}</span>}
              {rs >= 2 && <span style={{ fontSize: 10, fontWeight: 600, color: col, fontFamily: 'monospace' }}>{sec.avg > 0 ? '+' : ''}{sec.avg.toFixed(1)}%</span>}
              {rs >= 3 && cs >= 3 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{fmtCap(sec.total)}</span>}
            </button>
          );
        })}
      </div>

      {/* 선택된 섹터 상세 */}
      {selected && (
        <div style={{ background: 'var(--bg-surface)', border: `1px solid ${selected.avg > 0 ? (isKR ? 'rgba(255,107,107,0.3)' : 'rgba(46,232,165,0.3)') : (isKR ? 'rgba(108,180,255,0.3)' : 'rgba(255,107,107,0.3)')}`, borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-sm)' }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginRight: 8 }}>{selected.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: selected.avg > 0 ? upC : dnC, fontFamily: 'monospace' }}>
                {selected.avg > 0 ? '▲' : '▼'} {Math.abs(selected.avg).toFixed(2)}%
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{selected.count}종목 · 시총 {fmtCap(selected.total)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
            {selected.symbols.map(s => {
              const c = s.pct > 0 ? upC : s.pct < 0 ? dnC : 'var(--text-tertiary)';
              return (
                <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', textDecoration: 'none', padding: '5px 6px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-hover)' }}>
                  <div style={{ width: 3, height: 24, borderRadius: 4, background: c, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{s.symbol}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: c, fontFamily: 'monospace' }}>{s.pct > 0 ? '+' : ''}{s.pct.toFixed(2)}%</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div style={{ display: 'flex', gap: 'var(--sp-md)', marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)', alignItems: 'center' }}>
        <span>크기 = 시총</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
          <div style={{ width: 10, height: 10, borderRadius: 4, background: upC, opacity: 0.7 }} />
          <span>{isKR ? '상승' : '상승'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
          <div style={{ width: 10, height: 10, borderRadius: 4, background: dnC, opacity: 0.7 }} />
          <span>{isKR ? '하락' : '하락'}</span>
        </div>
      </div>
    </div>
  );
}
