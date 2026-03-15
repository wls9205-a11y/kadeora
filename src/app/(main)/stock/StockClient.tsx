'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import type { StockQuote } from '@/types/database';

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }
function fmtVol(n: number) {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
  if (n >= 10000) return (n / 10000).toFixed(0) + '만';
  return n.toLocaleString();
}
function fmtCap(n: number | null) {
  if (!n) return '-';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + '조';
  if (n >= 1e8) return (n / 1e8).toFixed(0) + '억';
  return n.toLocaleString();
}

export default function StockClient({ initialStocks, isDemo }: { initialStocks: StockQuote[]; isDemo: boolean }) {
  const [stocks, setStocks] = useState<StockQuote[]>(initialStocks);
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isDemo) return;
    const sb = createSupabaseBrowser();
    const channel = sb.channel('stock_quotes_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_quotes' }, payload => {
        const updated = payload.new as StockQuote;
        setStocks(prev => prev.map(s => s.id === updated.id ? updated : s));
        setFlash(prev => new Set([...prev, updated.id]));
        setTimeout(() => setFlash(prev => { const n = new Set(prev); n.delete(updated.id); return n; }), 1000);
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [isDemo]);

  const filtered = stocks.filter(s =>
    !search || s.name.includes(search) || s.symbol.includes(search)
  );

  const totalChange = stocks.reduce((sum, s) => sum + s.change_amount, 0);
  const rising = stocks.filter(s => s.change_amount > 0).length;
  const falling = stocks.filter(s => s.change_amount < 0).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#F1F5F9' }}>📈 실시간 주식 시세</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isDemo && <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>💡 미리보기</span>}
          {!isDemo && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10B981' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />실시간 연결됨
          </span>}
        </div>
      </div>

      {/* Market summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '상승 종목', value: `${rising}개`, color: '#10B981' },
          { label: '하락 종목', value: `${falling}개`, color: '#EF4444' },
          { label: '시장 분위기', value: rising > falling ? '강세' : falling > rising ? '약세' : '중립', color: rising > falling ? '#10B981' : '#EF4444' },
        ].map(item => (
          <div key={item.label} style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="종목명 또는 코드 검색..."
          className="kd-input"
          style={{ maxWidth: 280 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B' }}>
                {['종목', '현재가', '등락', '등락률', '거래량', '시가총액'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', color: '#64748B', fontWeight: 600, fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {h === '종목' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((stock, i) => {
                const isUp = stock.change_amt > 0;
                const isDown = stock.change_amt < 0;
                const color = isUp ? '#10B981' : isDown ? '#EF4444' : '#94A3B8';
                const isFlashing = flash.has(stock.id);
                return (
                  <tr key={stock.id} style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid #0f1620' : 'none',
                    background: isFlashing ? 'rgba(59,130,246,0.06)' : 'transparent',
                    transition: 'background 0.5s',
                  }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#F1F5F9' }}>{stock.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{stock.symbol}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#F1F5F9', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPrice(stock.price)}원
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {isUp ? '+' : ''}{fmtPrice(stock.change_amt)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: isUp ? 'rgba(16,185,129,0.15)' : isDown ? 'rgba(239,68,68,0.15)' : 'transparent',
                        color,
                      }}>
                        {isUp ? '▲' : isDown ? '▼' : '━'} {Math.abs(stock.change_pct).toFixed(2)}%
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtVol(stock.volume)}주
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#94A3B8' }}>
                      {fmtCap(stock.market_cap)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: '#475569', textAlign: 'right' }}>
        ※ 투자 참고용 정보입니다. 실제 매매에 활용 시 손실이 발생할 수 있습니다.
      </p>
    </div>
  );
}
