'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Stock {
  symbol: string; name: string; market: string; price: number;
  change_pct: number; market_cap: number; volume: number;
  currency?: string; sector?: string; updated_at: string;
}

function fmtCap(v: number, c?: string) {
  if (!v) return '-';
  if (c === 'USD') { if (v >= 1e12) return `$${(v/1e12).toFixed(1)}T`; if (v >= 1e9) return `$${(v/1e9).toFixed(0)}B`; return `$${(v/1e6).toFixed(0)}M`; }
  if (v >= 1e12) return `${(v/1e12).toFixed(1)}조`; if (v >= 1e8) return `${Math.round(v/1e8)}억`; return v.toLocaleString();
}

function fmtPrice(p: number, c?: string) { return c === 'USD' ? `$${p.toFixed(2)}` : `₩${p.toLocaleString()}`; }

export default function StockComparePage() {
  const searchParams = useSearchParams();
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [stockA, setStockA] = useState<Stock | null>(null);
  const [stockB, setStockB] = useState<Stock | null>(null);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.from('stock_quotes').select('symbol, name, market, price, change_pct, market_cap, volume, currency, sector, updated_at')
      .gt('price', 0).order('market_cap', { ascending: false })
      .then(({ data }) => {
        const stocks = (data || []) as Stock[];
        setAllStocks(stocks);
        // URL 파라미터로 종목 자동 선택 (?a=005930&b=000660)
        const paramA = searchParams.get('a');
        const paramB = searchParams.get('b');
        if (paramA) { const found = stocks.find(s => s.symbol === paramA || s.name === paramA); if (found) setStockA(found); }
        if (paramB) { const found = stocks.find(s => s.symbol === paramB || s.name === paramB); if (found) setStockB(found); }
        setLoading(false);
      });
  }, [searchParams]);

  const filterStocks = (q: string) => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return allStocks.filter(s => s.name.toLowerCase().includes(lower) || s.symbol.toLowerCase().includes(lower)).slice(0, 8);
  };

  const CompareRow = ({ label, a, b, highlight }: { label: string; a: string; b: string; highlight?: 'a' | 'b' | null }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
      <div style={{ textAlign: 'right', fontSize: 'var(--fs-sm)', fontWeight: highlight === 'a' ? 700 : 500, color: highlight === 'a' ? 'var(--brand)' : 'var(--text-primary)' }}>{a}</div>
      <div style={{ textAlign: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</div>
      <div style={{ textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: highlight === 'b' ? 700 : 500, color: highlight === 'b' ? 'var(--brand)' : 'var(--text-primary)' }}>{b}</div>
    </div>
  );

  const SelectBox = ({ value, search, setSearch, onSelect, placeholder }: { value: Stock | null; search: string; setSearch: (v: string) => void; onSelect: (s: Stock) => void; placeholder: string }) => (
    <div style={{ position: 'relative', flex: 1 }}>
      {value ? (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{value.name}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{value.symbol} · {value.market}</div>
          </div>
          <button onClick={() => { onSelect(null as any); setSearch(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-lg)' }}>✕</button>
        </div>
      ) : (
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none' }} />
          {search && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
              {filterStocks(search).map(s => (
                <button key={s.symbol} onClick={() => { onSelect(s); setSearch(''); }} style={{
                  display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 14px',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)',
                  borderBottom: '1px solid var(--border)', textAlign: 'left',
                }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{s.symbol}</span>
                </button>
              ))}
              {filterStocks(search).length === 0 && <div style={{ padding: 14, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', textAlign: 'center' }}>검색 결과 없음</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <Link href="/stock" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 주식 시세</Link>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 16px' }}>⚔️ 종목 비교</h1>

      {/* 종목 선택 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
        <SelectBox value={stockA} search={searchA} setSearch={setSearchA} onSelect={setStockA} placeholder="종목 A 검색..." />
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-tertiary)', paddingTop: 12 }}>VS</div>
        <SelectBox value={stockB} search={searchB} setSearch={setSearchB} onSelect={setStockB} placeholder="종목 B 검색..." />
      </div>

      {/* 비교 테이블 */}
      {stockA && stockB ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 16px 16px' }}>
          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 8, padding: '14px 0', borderBottom: '2px solid var(--border)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)' }}>{stockA.name}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{stockA.symbol}</div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-tertiary)' }}>항목</div>
            <div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)' }}>{stockB.name}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{stockB.symbol}</div>
            </div>
          </div>

          <CompareRow label="현재가" a={fmtPrice(stockA.price, stockA.currency)} b={fmtPrice(stockB.price, stockB.currency)} />
          <CompareRow label="등락률"
            a={`${stockA.change_pct > 0 ? '+' : ''}${stockA.change_pct.toFixed(2)}%`}
            b={`${stockB.change_pct > 0 ? '+' : ''}${stockB.change_pct.toFixed(2)}%`}
            highlight={stockA.change_pct > stockB.change_pct ? 'a' : stockB.change_pct > stockA.change_pct ? 'b' : null}
          />
          <CompareRow label="시가총액"
            a={fmtCap(stockA.market_cap, stockA.currency)}
            b={fmtCap(stockB.market_cap, stockB.currency)}
            highlight={stockA.market_cap > stockB.market_cap ? 'a' : stockB.market_cap > stockA.market_cap ? 'b' : null}
          />
          <CompareRow label="거래량"
            a={stockA.volume ? stockA.volume.toLocaleString() : '-'}
            b={stockB.volume ? stockB.volume.toLocaleString() : '-'}
            highlight={stockA.volume > stockB.volume ? 'a' : stockB.volume > stockA.volume ? 'b' : null}
          />
          <CompareRow label="섹터" a={stockA.sector || '-'} b={stockB.sector || '-'} />
          <CompareRow label="시장" a={stockA.market} b={stockB.market} />

          {/* 관련 블로그 */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/stock/${stockA.symbol}`} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{stockA.name} 상세 →</Link>
              <Link href={`/stock/${stockB.symbol}`} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{stockB.name} 상세 →</Link>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚔️</div>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, marginBottom: 8 }}>두 종목을 선택해서 비교하세요</div>
          <div style={{ fontSize: 'var(--fs-sm)' }}>시가총액, 등락률, 거래량 등을 한눈에 비교</div>
        </div>
      )}

      {/* 인기 비교 조합 */}
      <div style={{ marginTop: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>🔥 인기 비교</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            ['삼성전자', 'SK하이닉스'], ['현대차', '기아'], ['NAVER', '카카오'],
            ['삼성바이오로직스', '셀트리온'], ['LG에너지솔루션', '삼성SDI'],
          ].map(([a, b]) => (
            <button key={`${a}-${b}`} onClick={() => {
              const sa = allStocks.find(s => s.name === a);
              const sb2 = allStocks.find(s => s.name === b);
              if (sa) setStockA(sa);
              if (sb2) setStockB(sb2);
            }} style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>
              {a} vs {b}
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '16px 0' }}>
        ⚠️ 투자 참고용이며 투자 권유가 아닙니다.
      </p>
    </div>
  );
}
