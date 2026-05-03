'use client';
import { stockColor } from '@/lib/stockColor';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { fmtPrice, fmtCap } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';

interface Stock {
  symbol: string; name: string; market: string; price: number;
  change_pct: number; market_cap: number; volume: number;
  currency?: string; sector?: string; per?: number; dividend_yield?: number;
}

export default function StockSearchClient() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'market_cap'|'change_pct'|'volume'|'dividend_yield'>('market_cap');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    (sb as any).from('stock_quotes')
      .select('symbol, name, market, price, change_pct, market_cap, volume, currency, sector, per, dividend_yield')
      .gt('price', 0).order('market_cap', { ascending: false })
      .then(({ data }: any) => { setStocks(data || []); setLoading(false); });
  }, []);

  const sectors = useMemo(() => [...new Set(stocks.map(s => s.sector).filter(Boolean))].sort(), [stocks]);

  const filtered = useMemo(() => {
    let list = stocks;
    if (marketFilter !== 'ALL') list = list.filter(s => s.market === marketFilter);
    if (sectorFilter !== 'all') list = list.filter(s => s.sector === sectorFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'change_pct') return (b.change_pct ?? 0) - (a.change_pct ?? 0);
      if (sortBy === 'volume') return (b.volume ?? 0) - (a.volume ?? 0);
      if (sortBy === 'dividend_yield') return (b.dividend_yield ?? 0) - (a.dividend_yield ?? 0);
      return (b.market_cap ?? 0) - (a.market_cap ?? 0);
    }).slice(0, 100);
  }, [stocks, search, marketFilter, sectorFilter, sortBy]);

  return (
    <article style={{ maxWidth: 780, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 4, marginBottom: 8 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>›
        <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>›<span>검색</span>
      </nav>
      <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>🔍 종목 검색</h1>

      {/* Search + Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <input type="text" placeholder="🔍 종목 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['ALL','KOSPI','KOSDAQ','NYSE','NASDAQ'].map(m => (
            <button key={m} onClick={() => setMarketFilter(m)} style={{ padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: marketFilter === m ? 'var(--brand)' : 'var(--bg-hover)', color: marketFilter === m ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {m === 'ALL' ? '전체' : m}
            </button>
          ))}
          <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} style={{ padding: '5px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12 }}>
            <option value="all">전체 섹터</option>
            {sectors.map(s => <option key={s} value={s!}>{s}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '5px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12 }}>
            <option value="market_cap">시총순</option>
            <option value="change_pct">등락률순</option>
            <option value="volume">거래량순</option>
            <option value="dividend_yield">배당률순</option>
          </select>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>{loading ? '로딩 중...' : `${filtered.length}종목 (전체 ${stocks.length})`}</p>

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filtered.map((s, i) => {
          const pct = Number(s.change_pct);
          const isKR = s.currency !== 'USD';
          return (
            <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', textDecoration: 'none', color: 'inherit', borderRadius: 'var(--radius-xs)', background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 24 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.symbol} · {s.market} · {s.sector || '-'}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{fmtPrice(s.price, s.currency)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 55, textAlign: 'right', color: stockColor(pct, isKR) }}>
                {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 50, textAlign: 'right' }}>{fmtCap(Number(s.market_cap), s.currency)}</span>
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
        <Link href="/stock" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>전 종목 시세</Link>
        <Link href="/stock/dividend" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>배당주</Link>
      </div>
      <Disclaimer type="stock" />
    </article>
  );
}
