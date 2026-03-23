'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const PortfolioTab = dynamic(() => import('@/components/PortfolioTab'), { ssr: false });
const SectorHeatmap = dynamic(() => import('@/components/SectorHeatmap'), { ssr: false });
import MiniSparkline from '@/components/MiniSparkline';
import { fmtCap, stockColor, fmt } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import BottomSheet from '@/components/BottomSheet';

interface Stock {
  symbol: string; name: string; market: string; price: number; change_amt: number;
  change_pct: number; volume: number; market_cap: number; updated_at: string;
  currency?: string; sector?: string; description?: string;
}
interface Theme { id: number; theme_name: string; change_pct: number; is_hot: boolean; related_symbols?: string[]; description?: string; }
interface CalendarEvent { id: number; event_date: string; title: string; category: string; importance: string; description?: string; }
interface Props { initialStocks: Stock[]; briefing?: any; exchangeHistory?: any[]; themeHistory?: any[]; }

function isIdx(s: Stock) { return ['KOSPI','KOSDAQ','NASDAQ','S&P 500','DOW','NIKKEI'].some(idx => s.name.toUpperCase().includes(idx) || s.symbol.toUpperCase().includes(idx)); }

const M7 = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];
const SECTORS = ['all','반도체','바이오','금융','자동차','방산','IT/소프트웨어','에너지','2차전지','소비재','건설','통신','유틸리티','화학','미디어'];

// 한국: 상승=빨강, 하락=파랑 / 해외: 상승=초록, 하락=빨강
export default function StockClient({ initialStocks, briefing, exchangeHistory, themeHistory }: Props) {
  const [stocks, setStocks] = useState<Stock[]>(Array.isArray(initialStocks) ? initialStocks : []);
  const [mode, setMode] = useState<'domestic'|'global'>('domestic');
  const [domesticTab, setDomesticTab] = useState<'ranking'|'movers'|'themes'|'calendar'|'watchlist'|'portfolio'>('ranking');
  const [globalTab, setGlobalTab] = useState<'ranking'|'movers'|'m7'|'watchlist'|'portfolio'>('ranking');
  const [domesticMarket, setDomesticMarket] = useState<'ALL'|'KOSPI'|'KOSDAQ'>('ALL');
  const [moversTab, setMoversTab] = useState<'up'|'down'|'volume'>('up');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [exchangeRate, setExchangeRate] = useState(1500);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});

  useEffect(() => {
    fetch('/api/stock/themes').then(r => r.ok ? r.json() : null).then(d => { if (d?.themes) setThemes(d.themes); }).catch(() => {});
    fetch('/api/stock/calendar').then(r => r.ok ? r.json() : null).then(d => { if (d?.events) setCalendarEvents(d.events); }).catch(() => {});
    fetch('/api/stock/watchlist').then(r => r.ok ? r.json() : null).then(d => { if (d?.symbols) setWatchlistSymbols(d.symbols); }).catch(() => {});
    fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).then(d => { if (d?.rates?.KRW) setExchangeRate(d.rates.KRW); }).catch(() => {});
  }, []);

  // 모달 Escape 키 핸들러
  useEffect(() => {
    if (!selectedStock) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedStock(null); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [selectedStock]);

  const refresh = useCallback(async () => {
    try {
      const sb = (await import('@/lib/supabase-browser')).createSupabaseBrowser();
      const { data } = await sb.from('stock_quotes').select('symbol, name, market, price, change_amt, change_pct, volume, market_cap, currency, sector, updated_at, is_active').order('market_cap', { ascending: false });
      if (data?.length) setStocks(data as any);
    } catch (e) { if (process.env.NODE_ENV === 'development') console.warn('[Stock.refresh]', e); }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refresh();
    }, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  // 관심종목 스파크라인 데이터 로드
  useEffect(() => {
    if (!watchlistSymbols.length) return;
    fetch(`/api/stock/sparkline?symbols=${watchlistSymbols.join(',')}`)
      .then(r => r.json()).then(d => { if (d.data) setSparklines(d.data); }).catch(() => {});
  }, [watchlistSymbols]);

  const isDomestic = mode === 'domestic';
  const domesticStocks = stocks.filter(s => (s.market === 'KOSPI' || s.market === 'KOSDAQ') && !isIdx(s));
  const globalStocks = stocks.filter(s => (s.market === 'NYSE' || s.market === 'NASDAQ') && !isIdx(s));
  const indexStocks = stocks.filter(s => isIdx(s));

  // Market sentiment
  const sentimentStocks = isDomestic ? domesticStocks : globalStocks;
  const upCount = sentimentStocks.filter(s => (s.change_pct ?? 0) > 0).length;
  const downCount = sentimentStocks.filter(s => (s.change_pct ?? 0) < 0).length;
  const flatCount = sentimentStocks.length - upCount - downCount;
  const sentTotal = sentimentStocks.length || 1;

  // Filter and sort
  function getFilteredStocks() {
    let list = isDomestic ? domesticStocks : globalStocks;
    if (isDomestic && domesticMarket !== 'ALL') list = list.filter(s => s.market === domesticMarket);
    if (sectorFilter !== 'all') list = list.filter(s => (s.sector || '').includes(sectorFilter));
    if (search) { const q = search.toLowerCase(); list = list.filter(s => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)); }

    const tab = isDomestic ? domesticTab : globalTab;
    if (tab === 'movers') {
      if (moversTab === 'up') return [...list].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0)).slice(0, 20);
      if (moversTab === 'down') return [...list].sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0)).slice(0, 20);
      return [...list].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 20);
    }
    if (tab === 'watchlist') return list.filter(s => watchlistSymbols.includes(s.symbol));
    if (tab === 'm7') return list.filter(s => M7.includes(s.symbol));
    return [...list].sort((a, b) => {
      const aZero = a.price === 0 ? 1 : 0;
      const bZero = b.price === 0 ? 1 : 0;
      if (aZero !== bZero) return aZero - bZero;
      return (b.market_cap ?? 0) - (a.market_cap ?? 0);
    }).slice(0, 50);
  }

  const filteredStocks = getFilteredStocks();
  const currentTab = isDomestic ? domesticTab : globalTab;

  const toggleWatchlist = useCallback(async (symbol: string) => {
    const isWatched = watchlistSymbols.includes(symbol);
    try {
      const res = await fetch('/api/stock/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, action: isWatched ? 'remove' : 'add' }),
      });
      if (res.ok) {
        setWatchlistSymbols(prev => isWatched ? prev.filter(s => s !== symbol) : [...prev, symbol]);
      }
    } catch {}
  }, [watchlistSymbols]);

  function StockRow({ s, rank }: { s: Stock; rank: number }) {
    const pct = s.change_pct ?? 0;
    const isGlobal = s.currency === 'USD';
    const isWatched = watchlistSymbols.includes(s.symbol);
    return (
      <div onClick={() => setSelectedStock(s)} className="kd-feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer', borderRadius: 8, transition: 'background var(--transition-fast)' }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 22, textAlign: 'center' }}>{rank}</span>
        <button onClick={e => { e.stopPropagation(); toggleWatchlist(s.symbol); }} className={isWatched ? 'animate-like' : ''} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 'var(--fs-lg)', lineHeight: 1, color: isWatched ? 'var(--accent-yellow)' : 'var(--text-tertiary)', flexShrink: 0, transition: 'color var(--transition-fast)' }} title={isWatched ? '관심 해제' : '관심 추가'}>
          {isWatched ? '★' : '☆'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.symbol}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {s.sector && <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{s.sector}</span>}
            {s.market_cap > 0 && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{fmtCap(s.market_cap, s.currency)}</span>}
          </div>
        </div>
        {/* 미니 스파크라인 (관심종목에 히스토리 있을 때) */}
        {sparklines[s.symbol]?.length >= 2 && (
          <MiniSparkline data={sparklines[s.symbol]} width={48} height={20} />
        )}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {s.price === 0 ? (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>시세 미제공</span>
          ) : (
            <>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isGlobal ? `$${s.price?.toFixed(2)}` : `₩${fmt(s.price)}`}
              </div>
              {isGlobal && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>≈₩{Math.round(s.price * exchangeRate).toLocaleString()}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <div style={{ width: 32, height: 4, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(Math.abs(pct) * 10, 100)}%`, height: '100%', background: stockColor(pct, !isGlobal), borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: stockColor(pct, !isGlobal) }}>
                  {pct > 0 ? '▲' : pct < 0 ? '▼' : '—'} {Math.abs(pct).toFixed(2)}%
                </span>
              </div>
            </>
          )}
        </div>
        <Link href={`/stock/${encodeURIComponent(s.symbol)}`} onClick={e => e.stopPropagation()} style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px', borderRadius: 999, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', textDecoration: 'none', flexShrink: 0 }}>상세</Link>
      </div>
    );
  }

  const domesticTabs = [['ranking','📊 시총'],['movers','📈 등락률'],['themes','🔥 테마'],['calendar','📅 캘린더'],['watchlist','⭐ 관심'],['portfolio','💰 포트폴리오']] as const;
  const globalTabs = [['ranking','📊 시총'],['movers','📈 등락률'],['m7','🏆 M7'],['watchlist','⭐ 관심'],['portfolio','💰 포트폴리오']] as const;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>📊 주식</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/stock/compare" style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>⚔️ 비교</a>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>원/달러</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₩{exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
          {exchangeHistory && exchangeHistory.length > 1 && (() => {
            const rates = exchangeHistory.map((h: any) => h.rate);
            const min = Math.min(...rates); const max = Math.max(...rates);
            const range = max - min || 1;
            const points = rates.map((r: number, i: number) => `${(i / (rates.length - 1)) * 32},${16 - ((r - min) / range) * 14}`).join(' ');
            const isUp = rates[rates.length - 1] > rates[0];
            const changePct = rates.length >= 2 ? ((rates[rates.length-1] - rates[rates.length-2]) / rates[rates.length-2] * 100) : 0;
            return (
              <>
                <svg viewBox="0 0 32 16" style={{ width: 32, height: 16, verticalAlign: 'middle' }}><polyline points={points} fill="none" stroke={isUp ? 'var(--accent-red)' : 'var(--accent-green)'} strokeWidth="1.5" /></svg>
                {Math.abs(changePct) >= 0.1 && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: changePct > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{changePct > 0 ? '▲' : '▼'}{Math.abs(changePct).toFixed(1)}%</span>}
              </>
            );
          })()}
        </div>
        </div>
      </div>

      {/* AI 일일 시황 */}
      {briefing && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 'var(--fs-lg)' }}>{briefing.sentiment === 'bullish' ? '🐂' : briefing.sentiment === 'bearish' ? '🐻' : '😐'}</span>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)' }}>{briefing.title}</div>
            <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
              background: briefing.sentiment === 'bullish' ? 'var(--accent-green-bg)' : briefing.sentiment === 'bearish' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)',
              color: briefing.sentiment === 'bullish' ? 'var(--accent-green)' : briefing.sentiment === 'bearish' ? 'var(--accent-red)' : 'var(--text-secondary)',
            }}>{briefing.sentiment === 'bullish' ? '강세' : briefing.sentiment === 'bearish' ? '약세' : '보합'}</span>
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>{briefing.summary}</div>
          {/* Top movers badges */}
          {(briefing.key_movers || briefing.top_movers) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {((briefing.key_movers || briefing.top_movers)?.gainers || []).slice(0, 2).map((s: any) => (
                <span key={s.symbol} style={{ fontSize: 'var(--fs-xs)', padding: '3px 8px', borderRadius: 8, background: 'rgba(52,211,153,0.1)', color: 'var(--accent-green)', fontWeight: 600 }}>
                  ▲ {s.name} +{s.change_pct?.toFixed(1)}%
                </span>
              ))}
              {((briefing.key_movers || briefing.top_movers)?.losers || []).slice(0, 2).map((s: any) => (
                <span key={s.symbol} style={{ fontSize: 'var(--fs-xs)', padding: '3px 8px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', fontWeight: 600 }}>
                  ▼ {s.name} {s.change_pct?.toFixed(1)}%
                </span>
              ))}
            </div>
          )}
          {/* Sector analysis bars */}
          {briefing.sector_analysis?.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {briefing.sector_analysis.slice(0, 6).map((sec: any) => (
                <div key={sec.name} style={{
                  fontSize: 'var(--fs-xs)', padding: '3px 8px', borderRadius: 6,
                  background: (sec.avg_pct || 0) > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                  color: (sec.avg_pct || 0) > 0 ? 'var(--accent-red)' : 'var(--accent-blue)',
                  fontWeight: 600,
                }}>
                  {sec.name} {(sec.avg_pct || 0) > 0 ? '+' : ''}{sec.avg_pct}%
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>
            {briefing.briefing_date} 기준 · AI 자동 생성
          </div>
        </div>
      )}

      {/* 국내/해외 메인 토글 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => { setMode('domestic'); setSearch(''); setSectorFilter('all'); }} style={{
          flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 'var(--fs-md)', fontWeight: 700,
          background: isDomestic ? 'var(--brand)' : 'var(--bg-surface)',
          color: isDomestic ? 'var(--text-inverse)' : 'var(--text-tertiary)',
          border: isDomestic ? 'none' : '1px solid var(--border)', cursor: 'pointer',
        }}>🇰🇷 국내주식</button>
        <button onClick={() => { setMode('global'); setSearch(''); setSectorFilter('all'); }} style={{
          flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 'var(--fs-md)', fontWeight: 700,
          background: !isDomestic ? 'var(--accent-blue)' : 'var(--bg-surface)',
          color: !isDomestic ? 'var(--text-inverse)' : 'var(--text-tertiary)',
          border: !isDomestic ? 'none' : '1px solid var(--border)', cursor: 'pointer',
        }}>🇺🇸 해외주식</button>
      </div>

      {/* 지수 바 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {indexStocks.filter(s => isDomestic ? (s.market === 'KOSPI' || s.market === 'KOSDAQ') : (s.market === 'NYSE' || s.market === 'NASDAQ')).slice(0, 3).map(s => {
          const pct = s.change_pct ?? 0;
          return (
            <div key={s.symbol} style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, flexShrink: 0, minWidth: 140 }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)' }}>{s.currency === 'USD' ? `$${s.price?.toFixed(0)}` : fmt(s.price)}</span>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: stockColor(pct, isDomestic) }}>
                  {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </div>
              {s.change_amt !== undefined && s.change_amt !== 0 && (
                <div style={{ fontSize: 'var(--fs-xs)', color: stockColor(pct, isDomestic), marginTop: 1 }}>
                  {s.change_amt > 0 ? '+' : ''}{s.currency === 'USD' ? `$${s.change_amt.toFixed(0)}` : fmt(s.change_amt)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 섹터 히트맵 (국내) */}
      {isDomestic && (() => {
        const sectorMap = new Map<string, { up: number; down: number; flat: number; totalPct: number; count: number }>();
        domesticStocks.forEach(s => {
          if (!s.sector) return;
          const cur = sectorMap.get(s.sector) || { up: 0, down: 0, flat: 0, totalPct: 0, count: 0 };
          const pct = s.change_pct ?? 0;
          if (pct > 0) cur.up++; else if (pct < 0) cur.down++; else cur.flat++;
          cur.totalPct += pct; cur.count++;
          sectorMap.set(s.sector, cur);
        });
        const sectors = Array.from(sectorMap.entries()).map(([name, d]) => ({ name, avg: d.count > 0 ? d.totalPct / d.count : 0, ...d })).sort((a, b) => b.avg - a.avg);
        if (sectors.length < 2) return null;
        return (
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {sectors.map(s => (
              <button key={s.name} onClick={() => { setSectorFilter(s.name === sectorFilter ? 'all' : s.name); setDomesticTab('ranking'); }} style={{
                padding: '6px 10px', borderRadius: 8, border: sectorFilter === s.name ? '1px solid var(--brand)' : '1px solid var(--border)',
                background: sectorFilter === s.name ? 'rgba(37,99,235,0.1)' : s.avg > 1 ? 'rgba(248,113,113,0.08)' : s.avg < -1 ? 'rgba(96,165,250,0.08)' : 'var(--bg-surface)',
                cursor: 'pointer', flexShrink: 0, minWidth: 70, textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: stockColor(s.avg, true), marginTop: 2 }}>
                  {s.avg > 0 ? '+' : ''}{s.avg.toFixed(1)}%
                </div>
              </button>
            ))}
          </div>
        );
      })()}

      {/* 상승/하락 비율 */}
      {sentimentStocks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>
            <span style={{ color: isDomestic ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 600 }}>▲ {upCount}</span>
            <span>· — {flatCount}</span>
            <span style={{ color: isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)', fontWeight: 600 }}>· ▼ {downCount}</span>
          </div>
          <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${(upCount/sentTotal)*100}%`, background: isDomestic ? 'var(--accent-red)' : 'var(--accent-green)' }} />
            <div style={{ width: `${(flatCount/sentTotal)*100}%`, background: 'var(--bg-hover)' }} />
            <div style={{ width: `${(downCount/sentTotal)*100}%`, background: isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)' }} />
          </div>
        </div>
      )}

      {/* 서브 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px' }}>
        {(isDomestic ? domesticTabs : globalTabs).map(([k, l]) => (
          <button key={k} onClick={() => { isDomestic ? setDomesticTab(k as any) : setGlobalTab(k as any); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, fontWeight: 700, fontSize: 'var(--fs-sm)',
            background: currentTab === k ? 'var(--brand)' : 'transparent',
            color: currentTab === k ? 'var(--text-inverse)' : 'var(--text-secondary)',
          }}>{l}</button>
        ))}
      </div>

      {/* 캘린더 탭 */}
      {isDomestic && domesticTab === 'calendar' && (
        <div style={{ marginBottom: 16 }}>
          {calendarEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>예정된 이벤트가 없습니다</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>실적 발표, 배당, IPO 등 주요 일정이 등록되면 표시됩니다</div>
            </div>
          ) :
          calendarEvents.map(ev => (
            <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6, alignItems: 'center' }}>
              <div style={{ textAlign: 'center', flexShrink: 0, width: 44 }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{new Date(ev.event_date).toLocaleDateString('ko-KR',{month:'short'})}</div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{new Date(ev.event_date).getDate()}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.importance==='high'?'🔴':ev.importance==='medium'?'🟡':'⚪'} {ev.title}</div>
                {ev.description && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>{ev.description}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 테마 상세 탭 */}
      {isDomestic && domesticTab === 'themes' && (
        <div style={{ marginBottom: 16 }}>
          {/* 테마 필터 칩 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button onClick={() => setSelectedTheme(null)} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: !selectedTheme ? 'var(--brand)' : 'var(--bg-hover)', color: !selectedTheme ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>전체</button>
            {themes.map(t => (
              <button key={t.id} onClick={() => setSelectedTheme(selectedTheme === t.theme_name ? null : t.theme_name)} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: selectedTheme === t.theme_name ? 'var(--brand)' : 'var(--bg-hover)', color: selectedTheme === t.theme_name ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>{t.is_hot ? '🔥' : ''}{t.theme_name}</button>
            ))}
          </div>
          {themes.filter(t => !selectedTheme || t.theme_name === selectedTheme).map(t => {
            const th = themeHistory?.find((h: any) => h.theme_name === t.theme_name);
            return (
            <div key={t.id} style={{ padding: 16, background: 'var(--bg-surface)', border: selectedTheme === t.theme_name ? '2px solid var(--brand)' : '1px solid var(--border)', borderRadius: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)' }}>{t.is_hot&&'🔥 '}{t.theme_name}</span>
                  {(th?.avg_change_rate != null || th?.prev_change_pct != null) && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                      전일 {(Number(th.avg_change_rate ?? th.prev_change_pct) > 0 ? '+' : '')}{Number(th.avg_change_rate ?? th.prev_change_pct).toFixed(1)}%
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: stockColor(t.change_pct??0, true) }}>{(t.change_pct??0)>0?'+':''}{(t.change_pct??0).toFixed(1)}%</span>
              </div>
              {t.description && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>{t.description}</div>}
              {/* 테마 추이 스파크라인 */}
              {th?.history && Array.isArray(th.history) && th.history.length >= 2 && (() => {
                const vals = th.history.map((h: any) => Number(h.change_pct || h.avg_change_rate || 0));
                const min = Math.min(...vals); const max = Math.max(...vals);
                const range = max - min || 1; const W = 200; const H = 30; const P = 2;
                const points = vals.map((v: number, i: number) => `${P + (i / (vals.length - 1)) * (W - P * 2)},${H - P - ((v - min) / range) * (H - P * 2)}`).join(' ');
                const isUp = vals[vals.length - 1] >= vals[0];
                return (
                  <div style={{ marginBottom: 8 }}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 30 }}>
                      <polyline points={points} fill="none" stroke={isUp ? 'var(--accent-red)' : 'var(--accent-blue)'} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                      <span>{th.history[0]?.date?.slice(5) || ''}</span>
                      <span>{th.history[th.history.length - 1]?.date?.slice(5) || ''}</span>
                    </div>
                  </div>
                );
              })()}
              {t.related_symbols?.length && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {t.related_symbols.map(sym => {
                    const st = stocks.find(s => s.symbol === sym);
                    return st ? (
                      <Link key={sym} href={`/stock/${sym}`} style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', borderRadius: 999, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        {st.name} {(st.change_pct??0)>0?'▲':'▼'}{Math.abs(st.change_pct??0).toFixed(1)}%
                      </Link>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      {/* M7 카드 (해외) */}
      {!isDomestic && globalTab === 'm7' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)' }}>🏆 Magnificent 7</div>
            {(() => {
              const totalCap = M7.reduce((sum, sym) => { const st = stocks.find(s => s.symbol === sym); return sum + (st?.market_cap || 0); }, 0);
              return totalCap > 0 ? <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>합산 시총 {fmtCap(totalCap, 'USD')}</span> : null;
            })()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {M7.map((sym, idx) => {
              const st = stocks.find(s => s.symbol === sym);
              if (!st) return null;
              const pct = st.change_pct ?? 0;
              return (
                <Link key={sym} href={`/stock/${sym}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '12px', background: 'var(--bg-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{st.name}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>{sym}</div>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)' }}>${st.price?.toFixed(2)}</div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: stockColor(pct, false), marginTop: 2 }}>
                      {pct>0?'▲':pct<0?'▼':'—'} {Math.abs(pct).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtCap(st.market_cap, 'USD')}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 등락률 서브탭 */}
      {currentTab === 'movers' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {([['up','📈 상승'],['down','📉 하락'],['volume','🔥 거래량']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setMoversTab(k)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: 600, border: 'none', cursor: 'pointer', background: moversTab===k?'var(--brand)':'var(--bg-hover)', color: moversTab===k?'#fff':'var(--text-secondary)' }}>{l}</button>
            ))}
          </div>
          {isDomestic && (() => {
            const limitUp = domesticStocks.filter(s => (s.change_pct ?? 0) >= 29.5).length;
            const limitDown = domesticStocks.filter(s => (s.change_pct ?? 0) <= -29.5).length;
            const up5 = domesticStocks.filter(s => (s.change_pct ?? 0) >= 5).length;
            const down5 = domesticStocks.filter(s => (s.change_pct ?? 0) <= -5).length;
            return (limitUp > 0 || limitDown > 0 || up5 > 0 || down5 > 0) ? (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {limitUp > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 999, background: 'rgba(248,113,113,0.15)', color: 'var(--accent-red)', fontWeight: 700 }}>🔺 상한가 {limitUp}</span>}
                {limitDown > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 999, background: 'rgba(96,165,250,0.15)', color: 'var(--accent-blue)', fontWeight: 700 }}>🔻 하한가 {limitDown}</span>}
                {up5 > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 999, background: 'rgba(248,113,113,0.08)', color: 'var(--accent-red)', fontWeight: 600 }}>+5%↑ {up5}종목</span>}
                {down5 > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 999, background: 'rgba(96,165,250,0.08)', color: 'var(--accent-blue)', fontWeight: 600 }}>-5%↓ {down5}종목</span>}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* 섹터 필터 (시총/등락률) */}
      {(currentTab === 'ranking' || currentTab === 'movers') && (() => {
        const targetStocks = isDomestic ? domesticStocks : globalStocks;
        const sectorSet = new Set(targetStocks.map(s => s.sector).filter((s): s is string => !!s));
        const sectorList = ['all', ...Array.from(sectorSet).sort()];
        if (sectorList.length < 3) return null;
        return (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {sectorList.map(s => (
            <button key={s} onClick={() => setSectorFilter(s)} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: sectorFilter===s?'var(--text-primary)':'var(--bg-hover)', color: sectorFilter===s?'var(--bg-base)':'var(--text-tertiary)' }}>{s==='all'?'전체':s}</button>
          ))}
        </div>
        );
      })()}

      {/* 섹터 히트맵 (시총순위 탭) */}
      {domesticTab === 'ranking' && isDomestic && (
        <SectorHeatmap stocks={stocks.filter(s => s.market !== 'NASDAQ' && s.market !== 'NYSE')} isKR={true} />
      )}
      {!isDomestic && globalTab === 'ranking' && (
        <SectorHeatmap stocks={stocks.filter(s => s.market === 'NASDAQ' || s.market === 'NYSE')} isKR={false} />
      )}

      {/* KOSPI/KOSDAQ 토글 (국내 시총 탭) */}
      {isDomestic && domesticTab === 'ranking' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {(['ALL','KOSPI','KOSDAQ'] as const).map(m => (
            <button key={m} onClick={() => setDomesticMarket(m)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: 600, border: 'none', cursor: 'pointer', background: domesticMarket===m?(isDomestic?'var(--brand)':'var(--accent-blue)'):'var(--bg-hover)', color: domesticMarket===m?'#fff':'var(--text-secondary)' }}>
              {m==='ALL'?'전체':m}
            </button>
          ))}
        </div>
      )}

      {/* 검색 */}
      {currentTab !== 'calendar' && currentTab !== 'themes' && currentTab !== 'm7' && (
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="종목명 또는 코드 검색"
            style={{ padding: '8px 36px 8px 14px', fontSize: 'var(--fs-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-sm)', padding: 4 }}>✕</button>}
        </div>
      )}

      {/* 포트폴리오 탭 */}
      {currentTab === 'portfolio' && <PortfolioTab />}

      {/* 종목 리스트 */}
      {currentTab !== 'calendar' && currentTab !== 'themes' && currentTab !== 'm7' && currentTab !== 'portfolio' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px' }}>
          {filteredStocks.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              {currentTab === 'watchlist' ? (
                <div>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>관심종목을 추가해보세요</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 16 }}>종목 목록에서 ☆ 버튼을 눌러 추가할 수 있어요</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 8 }}>🔥 인기 종목</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {(isDomestic ? domesticStocks : globalStocks).slice(0, 5).map(s => (
                      <button key={s.symbol} onClick={() => toggleWatchlist(s.symbol)} style={{ fontSize: 'var(--fs-xs)', padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                        ☆ {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-tertiary)' }}>
                  {search ? `"${search}" 검색 결과가 없어요` : '데이터를 불러오는 중...'}
                  {search && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 8 }}>종목명, 종목코드, 섹터로 검색해보세요</div>}
                </div>
              )}
            </div>
          ) : filteredStocks.map((s, i) => <StockRow key={s.symbol} s={s} rank={i + 1} />)}
        </div>
      )}

      {/* 종목 비교 (국내 시총탭) */}
      {isDomestic && domesticTab === 'ranking' && (() => {
        const pairs = [['005930','000660','삼성전자 vs SK하이닉스'],['005380','000270','현대차 vs 기아'],['373220','006400','LG에너지 vs 삼성SDI']];
        const valid = pairs.map(([a,b,t]) => { const sa=stocks.find(s=>s.symbol===a); const sb=stocks.find(s=>s.symbol===b); return sa&&sb?{sa,sb,t}:null; }).filter(Boolean) as {sa:Stock;sb:Stock;t:string}[];
        if (!valid.length) return null;
        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🔀 종목 비교</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              {valid.map(c => (
                <div key={c.t} style={{ minWidth: 260, padding: 14, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>{c.t}</div>
                  <table style={{ width: '100%', fontSize: 'var(--fs-sm)', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}><td></td><td>{c.sa.name}</td><td>{c.sb.name}</td></tr></thead>
                    <tbody>
                      <tr><td style={{ color: 'var(--text-tertiary)', padding: '4px 0' }}>현재가</td><td style={{ fontWeight: 600 }}>₩{fmt(c.sa.price)}</td><td style={{ fontWeight: 600 }}>₩{fmt(c.sb.price)}</td></tr>
                      <tr><td style={{ color: 'var(--text-tertiary)', padding: '4px 0' }}>시총</td><td style={{ fontWeight: 600 }}>{fmtCap(c.sa.market_cap,c.sa.currency)}</td><td style={{ fontWeight: 600 }}>{fmtCap(c.sb.market_cap,c.sb.currency)}</td></tr>
                      <tr><td style={{ color: 'var(--text-tertiary)', padding: '4px 0' }}>등락</td>
                        <td style={{ fontWeight: 700, color: stockColor(c.sa.change_pct??0, true) }}>{(c.sa.change_pct??0)>0?'+':''}{(c.sa.change_pct??0).toFixed(2)}%</td>
                        <td style={{ fontWeight: 700, color: stockColor(c.sb.change_pct??0, true) }}>{(c.sb.change_pct??0)>0?'+':''}{(c.sb.change_pct??0).toFixed(2)}%</td>
                      </tr>
                      <tr><td style={{ color: 'var(--text-tertiary)', padding: '4px 0' }}>거래량</td><td style={{ fontWeight: 600, fontSize: 'var(--fs-xs)' }}>{c.sa.volume ? fmt(c.sa.volume) : '-'}</td><td style={{ fontWeight: 600, fontSize: 'var(--fs-xs)' }}>{c.sb.volume ? fmt(c.sb.volume) : '-'}</td></tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 면책 */}
      <Disclaimer type="stock" compact />

      {/* 종목 모달 */}
      {selectedStock && (
        <BottomSheet open={!!selectedStock} onClose={() => setSelectedStock(null)} title={selectedStock.name}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 6 }}>{selectedStock.symbol}</span>
              <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 6 }}>{selectedStock.market}</span>
              {selectedStock.sector && <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 6 }}>{selectedStock.sector}</span>}
            </div>

            {/* 가격 + 등락 */}
            <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)' }}>
                {selectedStock.currency === 'USD' ? `$${selectedStock.price?.toFixed(2)}` : `₩${fmt(selectedStock.price)}`}
              </div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: stockColor(selectedStock.change_pct??0, isDomestic), marginTop: 4 }}>
                {(selectedStock.change_pct??0)>0?'▲':'▼'} {selectedStock.change_amt ? `${(selectedStock.change_amt>0?'+':'')}${fmt(Math.abs(selectedStock.change_amt))}` : ''} ({Math.abs(selectedStock.change_pct??0).toFixed(2)}%)
              </div>
            </div>

            {/* 상세 지표 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>시가총액</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{fmtCap(selectedStock.market_cap, selectedStock.currency)}</div>
              </div>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>거래량</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{selectedStock.volume ? fmt(selectedStock.volume) : '-'}</div>
              </div>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전일대비</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: stockColor(selectedStock.change_pct??0, isDomestic), marginTop: 2 }}>{selectedStock.change_amt ? `${selectedStock.change_amt>0?'+':''}${fmt(selectedStock.change_amt)}` : '-'}</div>
              </div>
            </div>

            {/* 관심종목 + 상세 버튼 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => toggleWatchlist(selectedStock.symbol)} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: watchlistSymbols.includes(selectedStock.symbol) ? 'var(--accent-yellow-bg)' : 'var(--bg-hover)', color: watchlistSymbols.includes(selectedStock.symbol) ? 'var(--accent-yellow)' : 'var(--text-secondary)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                {watchlistSymbols.includes(selectedStock.symbol) ? '★ 관심종목 해제' : '☆ 관심종목 추가'}
              </button>
              <a href={`/stock/${encodeURIComponent(selectedStock.symbol)}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDomestic ? 'var(--brand)' : 'var(--accent-blue)', color: 'var(--text-inverse)', padding: 12, borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>
                종목 상세 →
              </a>
            </div>
        </BottomSheet>
      )}
    </div>
  );
}
