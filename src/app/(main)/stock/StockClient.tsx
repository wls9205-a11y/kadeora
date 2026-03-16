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
}

interface Props {
  initialStocks: Stock[];
}

function fmt(n: number) {
  if (!n) return '0';
  return n.toLocaleString('ko-KR');
}

function fmtCap(n: number) {
  if (!n) return '-';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + '조';
  if (n >= 1e8) return (n / 1e8).toFixed(0) + '억';
  return fmt(n);
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

export default function StockClient({ initialStocks }: Props) {
  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const [market, setMarket] = useState<'ALL' | 'KOSPI' | 'KOSDAQ'>('ALL');
  const [sort, setSort] = useState<'cap' | 'change' | 'volume'>('cap');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

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
      if (sort === 'cap') return (b.market_cap ?? 0) - (a.market_cap ?? 0);
      if (sort === 'change') return (b.change_pct ?? 0) - (a.change_pct ?? 0);
      return (b.volume ?? 0) - (a.volume ?? 0);
    });

  const isUp = (s: Stock) => (s.change_pct ?? 0) > 0;
  const isDown = (s: Stock) => (s.change_pct ?? 0) < 0;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>📈 실시간 주식시세</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
            KOSPI · KOSDAQ 주요 100종목
            {lastUpdated && <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>· 갱신 {lastUpdated}</span>}
          </p>
        </div>
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

      {/* 필터 바 */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 4, padding: '10px 12px', marginBottom: 10,
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* 시장 필터 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['ALL', 'KOSPI', 'KOSDAQ'] as const).map(m => (
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
            <button key={k} onClick={() => setSort(k)} style={{
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
        borderRadius: 4, overflow: 'hidden', minWidth: 800,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px 110px 100px 100px 90px 80px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>#</span>
          <span>종목</span>
          <span style={{ textAlign: 'right' }}>코드</span>
          <span style={{ textAlign: 'right' }}>현재가</span>
          <span style={{ textAlign: 'right' }}>등락</span>
          <span style={{ textAlign: 'right' }}>시가총액</span>
          <span style={{ textAlign: 'right' }}>갱신</span>
          <span style={{ textAlign: 'center' }}>토론</span>
        </div>

        {filtered.map((s, i) => (
          <div key={s.symbol} style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 80px 110px 100px 100px 90px 80px',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center',
            transition: 'background 0.1s',
            cursor: 'pointer',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--border)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>{i + 1}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                <span style={{
                  background: s.market === 'KOSPI' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                  color: s.market === 'KOSPI' ? '#3B82F6' : '#10B981',
                  padding: '1px 5px', borderRadius: 2, fontSize: 10, fontWeight: 700,
                }}>{s.market}</span>
              </div>
            </div>
            <span style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{s.symbol}</span>
            <span style={{
              textAlign: 'right', fontSize: 14, fontWeight: 700,
              color: isUp(s) ? 'var(--stock-up)' : isDown(s) ? 'var(--stock-down)' : 'var(--text-primary)',
            }}>
              {fmt(s.price)}
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
              {fmtCap(s.market_cap)}
            </span>
            <span style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {s.updated_at && s.updated_at !== '2000-01-01T00:00:00+00:00' ? timeDiff(s.updated_at) : '-'}
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
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            검색 결과가 없습니다
          </div>
        )}
      </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        * 주가는 Yahoo Finance 기준 · 한국 거래 시간(09:00~15:30) 중 5분마다 자동 갱신
      </div>
    </div>
  );
}