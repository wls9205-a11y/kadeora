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
  if (!n || n === 0) return '-';
  if (currency === 'USD') {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    return `$${n.toLocaleString()}`;
  }
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8) return `${Math.round(n / 1e8)}억`;
  return `${n.toLocaleString()}원`;
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

const INDEX_NAMES = ['KOSPI', 'KOSDAQ', 'NASDAQ', 'S&P 500', 'DOW', 'NIKKEI'];

function isIndexEntry(s: Stock) {
  return INDEX_NAMES.some(idx => s.name.toUpperCase().includes(idx) || s.symbol.toUpperCase().includes(idx));
}

function isStaleData(s: Stock) {
  if (!s.updated_at) return true;
  return s.updated_at.startsWith('2000-01-01');
}

function getMarketStatus(market: string): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const hour = kst.getHours();
  const min = kst.getMinutes();
  const day = kst.getDay();
  const totalMin = hour * 60 + min;
  if (day === 0 || day === 6) return '주말';
  if (market === 'KOSPI' || market === 'KOSDAQ') {
    return (totalMin >= 540 && totalMin <= 930) ? '장중' : '장 마감';
  }
  return (totalMin >= 1350 || totalMin <= 300) ? '장중' : '장 마감';
}

function ChangeDisplay({ s, large }: { s: Stock; large?: boolean }) {
  const stale = isStaleData(s);
  const pct = s.change_pct ?? 0;
  const fontSize = large ? 16 : 13;

  if (stale) return null;

  if (pct > 0) {
    return (
      <span style={{ color: '#ef4444', fontWeight: 700, fontSize, fontVariantNumeric: 'tabular-nums' }}>
        ▲ {Math.abs(pct).toFixed(2)}%
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span style={{ color: '#3b82f6', fontWeight: 700, fontSize, fontVariantNumeric: 'tabular-nums' }}>
        ▼ {Math.abs(pct).toFixed(2)}%
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontWeight: 600, fontSize, fontVariantNumeric: 'tabular-nums' }}>
      – 0.00%
      <span style={{ fontSize: 10, fontWeight: 500 }}>전일종가</span>
    </span>
  );
}

export default function StockClient({ initialStocks }: Props) {
  const [stocks, setStocks] = useState<Stock[]>(Array.isArray(initialStocks) ? initialStocks : []);
  const [market, setMarket] = useState<string>('ALL');
  const [sort, setSort] = useState<'cap' | 'change' | 'volume'>('cap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [showKRW, setShowKRW] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1380);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [sortBy, setSortBy] = useState('default');

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
      // 주식 데이터는 크론으로 갱신됨. 클라이언트에서는 Supabase에서 직접 조회
      const sb = (await import('@/lib/supabase-browser')).createSupabaseBrowser();
      const { data } = await sb.from('stock_quotes').select('*').order('market_cap', { ascending: false });
      if (data?.length) {
        setStocks(data as any);
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
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dirMul = sortDir === 'asc' ? 1 : -1;
      if (sort === 'cap') {
        const rate = exchangeRate || 1380;
        const aUSD = (a.currency === 'KRW' ? (a.market_cap ?? 0) / rate : (a.market_cap ?? 0));
        const bUSD = (b.currency === 'KRW' ? (b.market_cap ?? 0) / rate : (b.market_cap ?? 0));
        return dirMul * (bUSD - aUSD);
      }
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

  const MARKET_LABEL: Record<string, string> = { ALL: '전체', KOSPI: '코스피', KOSDAQ: '코스닥', NYSE: '뉴욕', NASDAQ: '나스닥' };

  // sortBy 드롭다운이 선택되면 메인 정렬을 오버라이드
  const sorted = sortBy !== 'default' ? [...filtered].sort((a, b) => {
    if (sortBy === 'pct_desc') return Number(b.change_pct) - Number(a.change_pct);
    if (sortBy === 'pct_asc') return Number(a.change_pct) - Number(b.change_pct);
    if (sortBy === 'price_desc') return Number(b.price) - Number(a.price);
    return 0;
  }) : filtered;

  // Separate index entries from regular stocks
  const indexEntries = sorted.filter(s => isIndexEntry(s));
  const regularStocks = sorted.filter(s => !isIndexEntry(s));

  function getIndexGradient(s: Stock) {
    const pct = s.change_pct ?? 0;
    if (pct > 0) return 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)';
    if (pct < 0) return 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)';
    return 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-hover) 100%)';
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>주식시세</h1>
            {(() => {
              const status = getMarketStatus(market === 'ALL' ? 'KOSPI' : market);
              const isOpen = status === '장중';
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: isOpen ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)',
                  color: isOpen ? '#16a34a' : 'var(--text-tertiary)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOpen ? '#16a34a' : '#94a3b8' }} />
                  {status}
                </span>
              );
            })()}
          </div>
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
              background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none',
              borderRadius: 20, padding: '8px 16px', fontSize: 13,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '갱신 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* Market index cards */}
      {indexEntries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(indexEntries.length, 3)}, 1fr)`, gap: 10, marginBottom: 14 }}>
          {indexEntries.map(s => {
            const stale = isStaleData(s);
            return (
              <div
                key={s.symbol}
                style={{
                  background: getIndexGradient(s),
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => setSelectedStock(s)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                  <span style={{
                    background: (MARKET_STYLE[s.market] ?? { bg: 'var(--bg-hover)' }).bg,
                    color: (MARKET_STYLE[s.market] ?? { color: 'var(--text-secondary)' }).color,
                    padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  }}>{s.market}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {fmtPrice(s)}
                  </span>
                  {stale ? (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>전일종가</span>
                  ) : (
                    <ChangeDisplay s={s} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 필터 탭 */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '6px 8px', marginBottom: 10,
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* 시장 필터 */}
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {['ALL', 'KOSPI', 'KOSDAQ', 'NYSE', 'NASDAQ'].map(m => (
            <button key={m} onClick={() => setMarket(m)} style={{
              flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13, position: 'relative',
              background: 'transparent',
              color: market === m ? 'var(--brand)' : 'var(--text-tertiary)',
              borderRadius: 0,
              borderBottom: market === m ? '2px solid var(--brand)' : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}>
              {MARKET_LABEL[m]}
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
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: sort === k ? 'var(--border)' : 'transparent',
              color: sort === k ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}>
              {l}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          background: 'var(--bg-hover)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)',
          cursor: 'pointer', outline: 'none', marginLeft: 'auto', flexShrink: 0,
        }}>
          <option value="default">기본순</option>
          <option value="pct_desc">등락률 ▲ 높은순</option>
          <option value="pct_asc">등락률 ▼ 낮은순</option>
          <option value="price_desc">가격 높은순</option>
        </select>
      </div>
      {/* 검색 */}
      <div style={{ marginBottom: 10 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="종목명 또는 코드 검색"
          style={{
            padding: '8px 14px', fontSize: 13,
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 시장 상태 */}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, textAlign: 'right' }}>
        {getMarketStatus(market === 'ALL' ? 'KOSPI' : market)} · {lastUpdated ? `마지막 업데이트: ${lastUpdated}` : '장 마감 기준'}
      </div>

      {/* 종목 카드 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {regularStocks.map((s, i) => {
          const badgeStyle = MARKET_STYLE[s.market] ?? { bg: 'var(--bg-hover)', color: 'var(--text-secondary)' };
          const stale = isStaleData(s);
          return (
            <div
              key={s.symbol}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'background 0.15s',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedStock(s)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
            >
              {/* 순위 */}
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700, width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
              {/* 종목명 + 시장 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <span style={{
                    background: badgeStyle.bg, color: badgeStyle.color,
                    padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  }}>{s.market}</span>
                  {s.sector && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.sector}</span>}
                </div>
              </div>
              {/* 가격 + 변동 */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                  color: stale ? 'var(--text-tertiary)' : isUp(s) ? '#ef4444' : isDown(s) ? '#3b82f6' : 'var(--text-primary)',
                }}>
                  {fmtPrice(s)}
                </div>
                {stale ? (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4 }}>전일종가</span>
                ) : (
                  <div style={{ marginTop: 2 }}><ChangeDisplay s={s} /></div>
                )}
              </div>
              <span style={{ textAlign: 'center' }}>
                <Link
                  href={`/stock/${encodeURIComponent(s.symbol)}`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    backgroundColor: 'var(--success-bg)', color: 'var(--success)',
                    border: '1px solid var(--success)', textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  상세
                </Link>
              </span>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            검색 결과가 없어요
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        * 국내 주가는 KIS/Yahoo Finance 기준 · 해외 주가는 Yahoo Finance 기준 · 환율: 1 USD = ₩{exchangeRate.toLocaleString()}
      </div>

      {/* 투자 면책 고지 */}
      <div style={{
        background:'var(--warning-bg)', border:'1px solid var(--warning)',
        borderRadius:6, padding:'8px 14px', marginTop:12,
        fontSize:12, color:'var(--text-secondary)', lineHeight:1.5,
      }}>
        본 서비스의 주식 정보는 투자 참고용이며 투자 권유가 아닙니다. 투자 손실에 대한 책임은 투자자 본인에게 있습니다.
      </div>

      {/* 데이터 출처 */}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
        시세 데이터: Naver Finance / Yahoo Finance API · 20분 지연 · 투자 참고용 제공 · 실제 거래 시 증권사 데이터 확인 필요
      </p>

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)' }}>{fmtPrice(selectedStock)}</span>
                  {isStaleData(selectedStock) && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>전일종가</span>
                  )}
                </div>
              </div>
              <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:12 }}>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>등락률</div>
                <div style={{ fontSize:18, fontWeight:800 }}>
                  {isStaleData(selectedStock) ? (
                    <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                  ) : (
                    <ChangeDisplay s={selectedStock} large />
                  )}
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
            <div style={{
              background:'var(--warning-bg)', border:'1px solid var(--warning)',
              borderRadius:10, padding:12, marginBottom:16, fontSize:12,
              color:'var(--text-secondary)', lineHeight:1.6,
            }}>
              <strong>초보자 팁:</strong> 시가총액은 회사의 전체 가치입니다.
              1조 이상이면 대형주, 1000억~1조는 중형주, 1000억 미만은 소형주로 봅니다.
            </div>
            <a href={`/stock/${encodeURIComponent(selectedStock?.symbol ?? '')}`} style={{ display:'block', textAlign:'center', background:'var(--brand)', color:'var(--text-inverse)', padding:12, borderRadius:8, textDecoration:'none', fontWeight:700, fontSize:14 }}>
              종목 상세 보기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
