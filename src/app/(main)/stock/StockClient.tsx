'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Stock {
  symbol: string;
  name: string;
  market: string;
  price: number;
  change_amt: number;
  change_pct: number;
  volume: number;
  market_cap: number;
  updated_at: string;
  currency?: string;
  sector?: string;
  description?: string;
}

interface Props {
  initialStocks: Stock[];
}

function fmt(n: number) {
  if (!n) return '0';
  return n.toLocaleString('ko-KR');
}

function fmtCap(n: number, currency?: string) {
  if (!n) return '-';
  if (currency === 'USD') {
    if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
    return `$${(n/1e6).toFixed(0)}M`;
  }
  if (n >= 1e12) return `${(n/1e12).toFixed(1)}조`;
  if (n >= 1e8) return `${(n/1e8).toFixed(0)}억`;
  return n.toLocaleString();
}

function timeDiff(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const MARKET_STYLE: Record<string, { bg: string; color: string }> = {
  KOSPI: { bg: 'var(--info-bg)', color: 'var(--info)' },
  KOSDAQ: { bg: 'var(--success-bg)', color: 'var(--success)' },
  NYSE: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  NASDAQ: { bg: 'var(--brand-light)', color: 'var(--brand)' },
};

export default function StockClient({ initialStocks }: Props) {
  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const [market, setMarket] = useState<string>('ALL');
  const [sort, setSort] = useState<'cap' | 'change' | 'volume'>('cap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [showKRW, setShowKRW] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1380);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('kd_currency');
    if (saved === 'KRW') setShowKRW(true);

    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (data?.rates?.KRW) setExchangeRate(data.rates.KRW);
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock-refresh');
      const data = await res.json();
      if (data.stocks?.length) {
        setStocks(data.stocks);
        setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const filtered = stocks
    .filter(s => market === 'ALL' || s.market === market)
    .filter(s => !search || s.name.includes(search) || s.symbol.includes(search))
    .sort((a, b) => {
      const dirMul = sortDir === 'asc' ? 1 : -1;
      if (sort === 'cap') return dirMul * ((b.market_cap ?? 0) - (a.market_cap ?? 0));
      if (sort === 'change') return dirMul * ((b.change_pct ?? 0) - (a.change_pct ?? 0));
      return dirMul * ((b.volume ?? 0) - (a.volume ?? 0));
    });

  const isUp = (s: Stock) => (s.change_pct ?? 0) > 0;
  const isDown = (s: Stock) => (s.change_pct ?? 0) < 0;

  function fmtPrice(s: Stock) {
    const isUSD = s.currency === 'USD';
    if (isUSD && showKRW) {
      return '₩' + Math.round(s.price * exchangeRate).toLocaleString('ko-KR');
    }
    if (isUSD) {
      return '$' + s.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '₩' + s.price.toLocaleString('ko-KR');
  }

  return (
    <div>
      {/* 투자 면책 고지 */}
      <div style={{
        background:'var(--warning-bg)', border:'1px solid var(--warning)',
        borderRadius:6, padding:'8px 14px', marginBottom:12,
        fontSize:12, color:'var(--text-secondary)', lineHeight:1.5,
      }}>
        ⚠️ 본 서비스의 주식 정보는 투자 참고용이며 투자 권유가 아닙니다. 투자 손실에 대한 책임은 투자자 본인에게 있습니다.
      </div>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>📈 실시간 주식시세</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
            국내·해외 주요 종목
            {lastUpdated && <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>· 마지막 업데이트: {lastUpdated}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => {
              const next = !showKRW;
              setShowKRW(next);
              localStorage.setItem('kd_currency', next ? 'KRW' : 'USD');
            }}
            style={{
              padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-hover)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {showKRW ? '₩ 원화' : '$ USD'}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--brand)', color: 'var(--text-inverse, #fff)', border: 'none',
              borderRadius: 20, padding: '8px 16px', fontSize: 13,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⟳ 갱신 중...' : '⟳ 새로고침'}
          </button>
        </div>
      </div>

      {/* 필터 바 */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 4, padding: '10px 12px', marginBottom: 10,
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* 시장 필터 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['ALL', 'KOSPI', 'KOSDAQ', 'NYSE', 'NASDAQ'].map(m => (
            <button key={m} onClick={() => setMarket(m)} style={{
              padding: '6px 12px', borderRadius: 2, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: market === m ? 'var(--brand)' : 'transparent',
              color: market === m ? 'var(--text-inverse, #fff)' : 'var(--text-tertiary)',
            }}>
              {m === 'ALL' ? '전체' : m}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        {/* 정렬 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([['cap', '시가총액'], ['change', '등락률'], ['volume', '거래량']] as const).map(([k, l]) => (
            <button key={k} onClick={() => {
              if (sort === k) { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }
              else { setSort(k); setSortDir('desc'); }
            }} style={{
              padding: '6px 12px', borderRadius: 2, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: sort === k ? 'var(--border)' : 'transparent',
              color: sort === k ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}>
              {l}
            </button>
          ))}
        </div>
        {/* 검색 */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="종목명 · 코드 검색"
          style={{
            marginLeft: 'auto', padding: '6px 12px', fontSize: 13,
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)', borderRadius: 4,
            color: 'var(--text-primary)', width: 180,
          }}
        />
      </div>

      {/* 종목 테이블 헤더 */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 4, overflow: 'hidden', minWidth: 500,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 100px 100px 80px 70px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>#</span>
          <span>종목</span>
          <span style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => {
            if (sort === 'cap') { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }
            else { setSort('cap'); setSortDir('desc'); }
          }}>
            현재가 {sort === 'cap' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
          </span>
          <span style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => {
            if (sort === 'change') { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }
            else { setSort('change'); setSortDir('desc'); }
          }}>
            등락 {sort === 'change' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
          </span>
          <span style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => {
            if (sort === 'cap') { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }
            else { setSort('cap'); setSortDir('desc'); }
          }}>
            시총 {sort === 'cap' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
          </span>
          <span style={{ textAlign: 'center' }}>토론</span>
        </div>

        {filtered.map((s, i) => {
          const badgeStyle = MARKET_STYLE[s.market] ?? { bg: 'var(--bg-hover)', color: 'var(--text-secondary)' };
          return (
          <div key={s.symbol} style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 100px 100px 80px 70px',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center',
            transition: 'background 0.1s',
            cursor: 'pointer',
          }}
            onClick={() => setSelectedStock(s)}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--border)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>{i + 1}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                <span style={{
                  background: badgeStyle.bg,
                  color: badgeStyle.color,
                  padding: '1px 5px', borderRadius: 2, fontSize: 10, fontWeight: 700,
                }}>{s.market}</span>
              </div>
            </div>
            <span style={{
              textAlign: 'right', fontSize: 14, fontWeight: 700,
              color: isUp(s) ? 'var(--stock-up)' : isDown(s) ? 'var(--stock-down)' : 'var(--text-primary)',
            }}>
              {fmtPrice(s)}
            </span>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: isUp(s) ? 'var(--stock-up)' : isDown(s) ? 'var(--stock-down)' : 'var(--text-tertiary)',
              }}>
                {isUp(s) ? '▲' : isDown(s) ? '▼' : '–'} {Math.abs(s.change_pct ?? 0).toFixed(2)}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {isUp(s) ? '+' : ''}{fmt(s.change_amt)}
              </div>
            </div>
            <span style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-tertiary)' }}>
              {fmtCap(s.market_cap, s.currency)}
            </span>
            <span style={{ textAlign: 'center' }}>
              <Link
                href={`/discussion/stock/${s.symbol}`}
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  backgroundColor: 'var(--success-bg)', color: 'var(--success)',
                  border: '1px solid var(--success)', textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                💬 토론
              </Link>
            </span>
          </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            검색 결과가 없습니다
          </div>
        )}
      </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        * 국내 주가는 KIS/Yahoo Finance 기준 · 해외 주가는 Yahoo Finance 기준 · 환율: 1 USD = ₩{exchangeRate.toLocaleString()}
      </div>

      {selectedStock && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setSelectedStock(null)}>
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, padding:24, maxWidth:480, width:'100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'var(--text-primary)' }}>{selectedStock.name}</h2>
                <span style={{ fontSize:13, color:'var(--text-tertiary)' }}>{selectedStock.symbol} · {selectedStock.market}</span>
              </div>
              <button onClick={() => setSelectedStock(null)} aria-label="닫기" style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text-secondary)' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:12 }}>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>현재가</div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)' }}>{fmtPrice(selectedStock)}</div>
              </div>
              <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:12 }}>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>등락률</div>
                <div style={{ fontSize:18, fontWeight:800, color: (selectedStock.change_pct ?? 0) >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' }}>
                  {(selectedStock.change_pct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(selectedStock.change_pct ?? 0).toFixed(2)}%
                </div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:12 }}>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>시가총액</div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>{fmtCap(selectedStock.market_cap, selectedStock.currency)}</div>
              </div>
              <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:12 }}>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>거래량</div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>{(selectedStock.volume ?? 0).toLocaleString()}</div>
              </div>
            </div>
            <a href={`/discussion/stock/${selectedStock.symbol}`} style={{ display:'block', textAlign:'center', background:'var(--brand)', color:'var(--text-inverse)', padding:12, borderRadius:8, textDecoration:'none', fontWeight:700, fontSize:14 }}>
              💬 종목 토론방 입장
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
