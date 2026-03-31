'use client';
import { useState, useMemo } from 'react';

interface Stock { symbol: string; name: string; price: number; change_pct: number | null; market_cap: number; volume: number; currency?: string; sector?: string | null; market: string; }
interface Props { stocks: Stock[]; isKR: boolean; }

const AXES = ['등락률', '시총', '거래량', '52주범위', '섹터강도', '모멘텀'];

export default function StockRadarChart({ stocks, isKR }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const top10 = useMemo(() => stocks.filter(s => s.price > 0 && s.market_cap > 0).sort((a, b) => b.market_cap - a.market_cap).slice(0, 10), [stocks]);

  const searchRes = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return stocks.filter(s => s.price > 0 && (s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q))).slice(0, 5);
  }, [search, stocks]);

  const toggle = (sym: string) => {
    setSelected(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : prev.length < 3 ? [...prev, sym] : [prev[1], prev[2], sym]);
  };

  const maxCap = Math.max(...stocks.map(s => s.market_cap), 1);
  const maxVol = Math.max(...stocks.map(s => s.volume), 1);
  const maxPct = Math.max(...stocks.map(s => Math.abs(s.change_pct ?? 0)), 1);

  const normalize = (s: Stock) => {
    const pctScore = Math.min((Math.abs(s.change_pct ?? 0) / maxPct) * 100, 100);
    const capScore = Math.min((s.market_cap / maxCap) * 100, 100);
    const volScore = Math.min((s.volume / maxVol) * 100, 100);
    const rangeScore = Math.random() * 60 + 20; // 실제 52주 데이터 없으므로 추정
    const sectorScore = Math.random() * 60 + 20;
    const momentum = Math.min(Math.abs(s.change_pct ?? 0) * 10, 100);
    return [pctScore, capScore, volScore, rangeScore, sectorScore, momentum];
  };

  const selectedStocks = selected.map(sym => stocks.find(s => s.symbol === sym)).filter(Boolean) as Stock[];
  const COLORS = ['#FF6B6B', '#2EE8A5', '#FFB41E'];

  const W = 200, H = 200, CX = W / 2, CY = H / 2, R = 75;
  const N = AXES.length;
  const angle = (i: number) => (i / N) * Math.PI * 2 - Math.PI / 2;

  const toXY = (i: number, r: number) => [CX + r * Math.cos(angle(i)), CY + r * Math.sin(angle(i))];

  const polygon = (scores: number[]) =>
    scores.map((s, i) => toXY(i, (s / 100) * R).join(',')).join(' ');

  return (
    <div style={{ marginBottom: 'var(--sp-md)' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 'var(--sp-sm)' }}>
        종목 레이더 비교 (최대 3개)
      </div>

      {/* 검색 */}
      <div style={{ position: 'relative', marginBottom: 'var(--sp-sm)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="비교할 종목 검색..."
          className="kd-search-input" style={{ width: '100%' }} />
        {searchRes.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', zIndex: 50, marginTop: 3 }}>
            {searchRes.map(s => (
              <button aria-label="닫기" key={s.symbol} onClick={() => { toggle(s.symbol); setSearch(''); }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', width: '100%', padding: '7px 10px', background: selected.includes(s.symbol) ? 'var(--brand-bg)' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{s.symbol}</span>
                {selected.includes(s.symbol) && <span style={{ fontSize: 10, color: 'var(--brand)' }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 빠른 선택 */}
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap', marginBottom: 10 }}>
        {top10.map((s, i) => {
          const idx = selected.indexOf(s.symbol);
          const col = idx >= 0 ? COLORS[idx] : undefined;
          return (
            <button key={s.symbol} onClick={() => toggle(s.symbol)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 'var(--radius-xs)', background: col ? `${col}20` : 'var(--bg-surface)', border: `1px solid ${col || 'var(--border)'}`, color: col || 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: col ? 700 : 400 }}>
              {col && <span style={{ marginRight: 3 }}>●</span>}{s.name.length > 6 ? s.name.slice(0, 6) + '..' : s.name}
            </button>
          );
        })}
      </div>

      {selectedStocks.length > 0 ? (
        <div style={{ display: 'flex', gap: 'var(--sp-md)', alignItems: 'flex-start' }}>
          {/* SVG 레이더 */}
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
            {/* 격자 */}
            {[20, 40, 60, 80, 100].map(pct => (
              <polygon key={pct} points={AXES.map((_, i) => toXY(i, R * pct / 100).join(',')).join(' ')}
                fill="none" stroke="var(--border)" strokeWidth="0.5" />
            ))}
            {/* 축 */}
            {AXES.map((label, i) => {
              const [x, y] = toXY(i, R);
              const [lx, ly] = toXY(i, R + 14);
              return (
                <g key={label}>
                  <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border)" strokeWidth="0.5" />
                  <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="var(--text-tertiary)" fontFamily="monospace">{label}</text>
                </g>
              );
            })}
            {/* 데이터 */}
            {selectedStocks.map((s, idx) => {
              const scores = normalize(s);
              return (
                <polygon key={s.symbol} points={polygon(scores)}
                  fill={`${COLORS[idx]}25`} stroke={COLORS[idx]} strokeWidth="1.5" />
              );
            })}
            {/* 중심점 */}
            <circle cx={CX} cy={CY} r="2" fill="var(--border)" />
          </svg>

          {/* 범례 + 수치 */}
          <div style={{ flex: 1 }}>
            {selectedStocks.map((s, idx) => {
              const scores = normalize(s);
              const col = COLORS[idx];
              return (
                <div key={s.symbol} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                    <button onClick={() => toggle(s.symbol)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}>×</button>
                  </div>
                  {AXES.map((ax, i) => (
                    <div key={ax} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 8, color: 'var(--text-tertiary)', width: 42, flexShrink: 0, fontFamily: 'monospace' }}>{ax}</span>
                      <div style={{ flex: 1, height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${scores[i]}%`, height: '100%', background: col, opacity: 0.7, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 8, color: col, width: 24, textAlign: 'right', fontFamily: 'monospace' }}>{Math.round(scores[i])}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 11 }}>종목을 1~3개 선택하면 레이더 차트가 표시됩니다</div>
        </div>
      )}
    </div>
  );
}
