'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import SectionShareButton from '@/components/SectionShareButton';
import { fmtCap, fmtPrice } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import GatedStockSection from '@/components/stock/GatedStockSection';

interface Stock {
  symbol: string; name: string; market: string; price: number;
  change_pct: number; market_cap: number; volume: number;
  currency?: string; sector?: string; updated_at: string;
}

export default function CompareClient() {
  const searchParams = useSearchParams();
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [stockA, setStockA] = useState<Stock | null>(null);
  const [stockB, setStockB] = useState<Stock | null>(null);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [, setLoading] = useState(true);
  const [histA, setHistA] = useState<{date:string;close:number}[]>([]);
  const [histB, setHistB] = useState<{date:string;close:number}[]>([]);

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

  useEffect(() => {
    if (!stockA) return;
    const sb = createSupabaseBrowser();
    sb.from('stock_price_history').select('date, close_price').eq('symbol', stockA.symbol).order('date', { ascending: true }).limit(30)
      .then(({data}) => setHistA((data || []).map((d:any) => ({date: d.date, close: Number(d.close_price)}))));
  }, [stockA]);

  useEffect(() => {
    if (!stockB) return;
    const sb = createSupabaseBrowser();
    sb.from('stock_price_history').select('date, close_price').eq('symbol', stockB.symbol).order('date', { ascending: true }).limit(30)
      .then(({data}) => setHistB((data || []).map((d:any) => ({date: d.date, close: Number(d.close_price)}))));
  }, [stockB]);

  const filterStocks = (q: string) => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return allStocks.filter(s => s.name.toLowerCase().includes(lower) || s.symbol.toLowerCase().includes(lower)).slice(0, 8);
  };

  const CompareRow = ({ label, a, b, highlight }: { label: string; a: string; b: string; highlight?: 'a' | 'b' | null }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
      <div style={{
        textAlign: 'right', fontSize: 13, fontWeight: highlight === 'a' ? 700 : 500,
        color: highlight === 'a' ? 'var(--brand)' : 'var(--text-primary)',
        background: highlight === 'a' ? 'rgba(59,123,246,0.06)' : 'transparent',
        padding: highlight === 'a' ? '2px 8px' : 0, borderRadius: 4,
      }}>{a} {highlight === 'a' && <span style={{ fontSize: 10, color: 'var(--brand)' }}>WIN</span>}</div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</div>
      <div style={{
        textAlign: 'left', fontSize: 13, fontWeight: highlight === 'b' ? 700 : 500,
        color: highlight === 'b' ? 'var(--brand)' : 'var(--text-primary)',
        background: highlight === 'b' ? 'rgba(59,123,246,0.06)' : 'transparent',
        padding: highlight === 'b' ? '2px 8px' : 0, borderRadius: 4,
      }}>{highlight === 'b' && <span style={{ fontSize: 10, color: 'var(--brand)' }}>WIN </span>}{b}</div>
    </div>
  );

  const SelectBox = ({ value, search, setSearch, onSelect, placeholder }: { value: Stock | null; search: string; setSearch: (v: string) => void; onSelect: (s: Stock | null) => void; placeholder: string }) => (
    <div style={{ position: 'relative', flex: 1 }}>
      {value ? (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{value.name}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{value.symbol} · {value.market}</div>
          </div>
          <button onClick={() => { onSelect(null); setSearch(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-lg)' }}>✕</button>
        </div>
      ) : (
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none' }} />
          {search && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginTop: 'var(--sp-xs)', maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
              {filterStocks(search).map(s => (
                <button aria-label="닫기" key={s.symbol} onClick={() => { onSelect(s); setSearch(''); }} style={{
                  display: 'flex', justifyContent: 'space-between', width: '100%', padding: 'var(--sp-md) var(--card-p)',
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <Link href="/stock" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 주식 시세</Link>
      <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 6px' }}>종목 비교</h1>
      <div style={{ marginBottom: 12 }}><SectionShareButton section="stock-compare" label="종목 비교 — 주가·시총·등락률 비교 분석" pagePath="/stock/compare" /></div>

      {/* 종목 선택 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--sp-lg)', alignItems: 'flex-start' }}>
        <SelectBox value={stockA} search={searchA} setSearch={setSearchA} onSelect={setStockA} placeholder="🔍 종목 A" />
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-tertiary)', paddingTop: 10 }}>VS</div>
        <SelectBox value={stockB} search={searchB} setSearch={setSearchB} onSelect={setStockB} placeholder="🔍 종목 B" />
      </div>

      {/* 비교 테이블 */}
      {stockA && stockB ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '4px 14px 14px' }}>
          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 6, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{stockA.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{stockA.symbol}</div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>항목</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{stockB.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{stockB.symbol}</div>
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
          <div style={{ marginTop: 'var(--sp-lg)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
              <Link href={`/stock/${stockA.symbol}`} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{stockA.name} 상세 →</Link>
              <Link href={`/stock/${stockB.symbol}`} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{stockB.name} 상세 →</Link>
            </div>
          </div>

          {/* 30일 가격 추이 오버레이 */}
          {histA.length > 1 && histB.length > 1 && stockA && stockB && (() => {
            const normalize = (data: {close:number}[]) => {
              const base = data[0].close || 1;
              return data.map(d => ((d.close - base) / base) * 100);
            };
            const nA = normalize(histA);
            const nB = normalize(histB);
            const all = [...nA, ...nB];
            const min = Math.min(...all);
            const max = Math.max(...all);
            const range = max - min || 1;
            const w = 300;
            const h = 120;
            const toPoints = (vals: number[]) => vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
            return (
              <GatedStockSection sectionKey="compare_detailed" pageType="compare" fallbackTitle={`${stockA.name} × ${stockB.name} 상세 비교`}>
              <div style={{ marginTop: 'var(--sp-lg)', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>📈 30일 수익률 비교 (%)</div>
                <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
                  <polyline points={toPoints(nA)} fill="none" stroke="var(--brand)" strokeWidth="2" />
                  <polyline points={toPoints(nB)} fill="none" stroke="var(--accent-orange)" strokeWidth="2" />
                  <line x1="0" y1={h - ((0 - min) / range) * h} x2={w} y2={h - ((0 - min) / range) * h} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4" />
                </svg>
                <div style={{ display: 'flex', gap: 'var(--sp-lg)', marginTop: 6, fontSize: 11 }}>
                  <span style={{ color: 'var(--brand)', fontWeight: 700 }}>● {stockA.name}</span>
                  <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>● {stockB.name}</span>
                </div>
              </div>
              </GatedStockSection>
            );
          })()}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>⚔️</div>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, marginBottom: 'var(--sp-sm)' }}>두 종목을 선택해서 비교하세요</div>
          <div style={{ fontSize: 'var(--fs-sm)' }}>시가총액, 등락률, 거래량 등을 한눈에 비교</div>
        </div>
      )}

      {/* 인기 비교 조합 */}
      <div style={{ marginTop: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>인기 비교</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-xs)' }}>
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
              padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>
              {a} vs {b}
            </button>
          ))}
        </div>
      </div>

      <Disclaimer type="stock" compact />
    </div>
  );
}
