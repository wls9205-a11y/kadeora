'use client';
import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';

interface Stock { symbol: string; name: string; price: number; change_pct: number | null; market_cap: number; currency?: string; sector?: string | null; market: string; }
interface Props { stocks: Stock[]; isKR: boolean; }
interface Holding { symbol: string; name: string; pct: number; isUS: boolean; }

const SEG_COLORS = ['#3B7BF6','#FF6B6B','#2EE8A5','#FFB41E','#B794FF','#FF9F43','#6CB4FF','#EC4899','#14B8A6','#F59E0B'];

export default function PortfolioSimulator({ stocks, isKR }: Props) {
  const [holdings, setHoldings] = useState<{ stock: Holding; alloc: number }[]>([]);
  const [amount, setAmount] = useState(1000); // 만원
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return stocks.filter(s => s.price > 0 && (s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q))).slice(0, 6);
  }, [search, stocks]);

  const addHolding = useCallback((s: Stock) => {
    if (holdings.find(h => h.stock.symbol === s.symbol)) { setSearch(''); setShowSearch(false); return; }
    const n = holdings.length + 1;
    const base = Math.floor(100 / n);
    const rem = 100 - base * (n - 1);
    setHoldings(prev => {
      const updated = prev.map((h, i) => ({ ...h, alloc: base }));
      return [...updated, { stock: { symbol: s.symbol, name: s.name, pct: s.change_pct ?? 0, isUS: s.currency === 'USD' }, alloc: rem }];
    });
    setSearch(''); setShowSearch(false);
  }, [holdings]);

  const removeHolding = useCallback((symbol: string) => {
    setHoldings(prev => {
      const next = prev.filter(h => h.stock.symbol !== symbol);
      if (!next.length) return next;
      const base = Math.floor(100 / next.length);
      const rem = 100 - base * (next.length - 1);
      return next.map((h, i) => ({ ...h, alloc: i === 0 ? rem : base }));
    });
  }, []);

  const setAlloc = useCallback((symbol: string, val: number) => {
    setHoldings(prev => prev.map(h => h.stock.symbol === symbol ? { ...h, alloc: val } : h));
  }, []);

  const { weightedPct, profit, totalAlloc } = useMemo(() => {
    const totalAlloc = holdings.reduce((s, h) => s + h.alloc, 0);
    const weightedPct = holdings.reduce((s, h) => s + (h.stock.pct * h.alloc) / 100, 0);
    const profit = amount * 10000 * weightedPct / 100;
    return { weightedPct, profit, totalAlloc };
  }, [holdings, amount]);

  const fmtAmt = (v: number) => v >= 10000 ? `₩${(v/10000).toFixed(0)}억` : v >= 1000 ? `₩${(v/1000).toFixed(1)}억` : `₩${v.toLocaleString()}만`;
  const profitColor = weightedPct > 0.01 ? 'var(--accent-red)' : weightedPct < -0.01 ? 'var(--accent-blue)' : 'var(--text-tertiary)';
  const profitStr = profit > 0 ? `+${fmtAmt(Math.abs(profit / 10000))}` : profit < 0 ? `-${fmtAmt(Math.abs(profit / 10000))}` : '±0';

  // 빠른 추가용 top 종목
  const quickStocks = useMemo(() => stocks.filter(s => s.price > 0 && s.market_cap > 0).sort((a, b) => (b.market_cap - a.market_cap)).slice(0, 8), [stocks]);

  return (
    <div style={{ marginBottom: 'var(--sp-lg)' }}>
      {/* KPI 상단 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 'var(--sp-md)' }}>
        {[
          { label: '투자 원금', val: `₩${amount.toLocaleString()}만`, color: 'var(--text-primary)' },
          { label: '예상 수익', val: holdings.length ? profitStr : '—', color: profitColor },
          { label: '평균 등락', val: holdings.length ? `${weightedPct > 0 ? '+' : ''}${weightedPct.toFixed(2)}%` : '—', color: profitColor },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 3 }}>{kpi.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: kpi.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>{kpi.val}</div>
          </div>
        ))}
      </div>

      {/* 원금 슬라이더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', flexShrink: 0 }}>원금</span>
        <input type="range" min={100} max={10000} step={100} value={amount} onChange={e => setAmount(+e.target.value)}
          style={{ flex: 1, accentColor: 'var(--brand)', height: 4, cursor: 'pointer' }} />
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', minWidth: 52, textAlign: 'right' }}>{amount.toLocaleString()}만</span>
      </div>

      {/* 검색 */}
      <div style={{ position: 'relative', marginBottom: 'var(--sp-sm)' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setShowSearch(true); }} onFocus={() => setShowSearch(true)}
          placeholder="종목 검색해서 추가..." className="kd-search-input" style={{ width: '100%' }} />
        {showSearch && searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', zIndex: 50, marginTop: 'var(--sp-xs)', overflow: 'hidden' }}>
            {searchResults.map(s => (
              <button aria-label="닫기" key={s.symbol} onClick={() => addHolding(s)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{s.symbol}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: (s.change_pct ?? 0) > 0 ? (s.currency === 'USD' ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--accent-blue)' }}>{(s.change_pct ?? 0) > 0 ? '+' : ''}{(s.change_pct ?? 0).toFixed(2)}%</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 빠른 추가 */}
      {!holdings.length && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 5 }}>시총 상위 빠른 추가</div>
          <div style={{ display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap' }}>
            {quickStocks.map(s => (
              <button key={s.symbol} onClick={() => addHolding(s)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {s.name.length > 5 ? s.name.slice(0, 5) + '..' : s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 담긴 종목 */}
      {holdings.length > 0 && (
        <>
          {/* 비율 바 */}
          <div style={{ height: 20, borderRadius: 'var(--radius-xs)', overflow: 'hidden', display: 'flex', marginBottom: 6 }}>
            {holdings.map((h, i) => (
              <div key={h.stock.symbol} style={{ width: `${h.alloc}%`, background: SEG_COLORS[i % SEG_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width .3s', overflow: 'hidden' }}>
                {h.alloc > 10 && <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>{h.stock.name.slice(0, 4)}</span>}
              </div>
            ))}
          </div>
          {totalAlloc !== 100 && (
            <div style={{ fontSize: 9, color: 'var(--accent-yellow)', fontFamily: 'monospace', marginBottom: 'var(--sp-xs)' }}>비중 합계 {totalAlloc}% (100% 맞춰주세요)</div>
          )}

          {/* 종목 리스트 + 슬라이더 */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 'var(--sp-sm)' }}>
            {holdings.map((h, i) => {
              const c = h.stock.pct > 0 ? (h.stock.isUS ? 'var(--accent-green)' : 'var(--accent-red)') : h.stock.pct < 0 ? (h.stock.isUS ? 'var(--accent-red)' : 'var(--accent-blue)') : 'var(--text-tertiary)';
              const seg = SEG_COLORS[i % SEG_COLORS.length];
              const itemProfit = amount * 10000 * (h.alloc / 100) * (h.stock.pct / 100);
              return (
                <div key={h.stock.symbol} style={{ padding: '9px 12px', borderBottom: i < holdings.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: seg, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{h.stock.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: c, fontFamily: 'monospace' }}>{h.stock.pct > 0 ? '+' : ''}{h.stock.pct.toFixed(2)}%</span>
                    <span style={{ fontSize: 10, color: c, fontFamily: 'monospace' }}>→{itemProfit > 0 ? '+' : ''}{fmtAmt(Math.abs(itemProfit / 10000))}</span>
                    <button onClick={() => removeHolding(h.stock.symbol)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 24, textAlign: 'right', flexShrink: 0 }}>{h.alloc}%</span>
                    <input type="range" min={0} max={100} step={5} value={h.alloc} onChange={e => setAlloc(h.stock.symbol, +e.target.value)}
                      style={{ flex: 1, accentColor: seg, height: 3, cursor: 'pointer' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 구성 범례 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {holdings.map((h, i) => (
              <div key={h.stock.symbol} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-tertiary)' }}>
                <div style={{ width: 7, height: 7, borderRadius: 1, background: SEG_COLORS[i % SEG_COLORS.length] }} />
                {h.stock.name.slice(0, 5)} {h.alloc}%
              </div>
            ))}
          </div>
        </>
      )}

      {!holdings.length && (
        <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 28, marginBottom: 'var(--sp-sm)' }}>💼</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--sp-xs)' }}>종목을 담아보세요</div>
          <div style={{ fontSize: 11 }}>비중 조절 후 예상 수익을 계산합니다</div>
        </div>
      )}
    </div>
  );
}
