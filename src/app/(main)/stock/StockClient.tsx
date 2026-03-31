'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const PortfolioTab = dynamic(() => import('@/components/PortfolioTab'), { ssr: false });
const SectorHeatmap = dynamic(() => import('@/components/SectorHeatmap'), { ssr: false });
const StockDetailSheet = dynamic(() => import('./StockDetailSheet'), { ssr: false });
const StockTreemap = dynamic(() => import('@/components/StockTreemap'), { ssr: false });
const PortfolioSimulator = dynamic(() => import('@/components/PortfolioSimulator'), { ssr: false });
const GlobalPanorama = dynamic(() => import('@/components/GlobalPanorama'), { ssr: false });
const StockRadarChart = dynamic(() => import('@/components/StockRadarChart'), { ssr: false });
import MiniSparkline from '@/components/MiniSparkline';
import { fmtCap, stockColor, fmt } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import SectionShareButton from '@/components/SectionShareButton';

interface Stock {
  symbol: string; name: string; market: string; price: number; change_amt: number;
  change_pct: number; volume: number; market_cap: number; updated_at: string;
  currency?: string; sector?: string; description?: string;
}
interface Theme { id: number; theme_name: string; change_pct: number; is_hot: boolean; related_symbols?: string[]; description?: string; }
interface CalendarEvent { id: number; event_date: string; title: string; category: string; importance: string; description?: string; }
interface Props { initialStocks: Stock[]; briefing?: Record<string, any>; briefingUS?: Record<string, any>; exchangeHistory?: Record<string, any>[]; themeHistory?: Record<string, any>[]; }

const IDX_SYMBOLS = new Set(['SPY','QQQ','DIA','IWM','VOO','VTI','TQQQ','SQQQ','SOXL','SPXL','ARKK','GLD','SLV','TLT','USO','VNQ','SCHD','JEPI','XLK','XLF','XLE','XLV','KWEB','EEM','EWJ','FXI','UVXY']);
function isIdx(s: Stock) {
  if (IDX_SYMBOLS.has(s.symbol)) return true;
  if (s.sector === 'ETF') return true;
  return ['KOSPI','KOSDAQ','NIKKEI'].some(idx => s.name.toUpperCase().includes(idx) || s.symbol.toUpperCase().includes(idx));
}

const M7 = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];

function getMarketStatus(): { label: string; color: string } {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  const day = kst.getUTCDay();
  const kstMin = h * 60 + m;
  // Weekend
  if (day === 0 || day === 6) return { label: '⏸ 휴장', color: 'var(--text-tertiary)' };
  // KR market: 09:00~15:30 KST
  if (kstMin >= 540 && kstMin <= 930) return { label: '🟢 장중', color: 'var(--accent-green)' };
  // US market: 22:30~05:00 KST (next day)
  if (kstMin >= 1350 || kstMin <= 300) return { label: '🟢 미국장중', color: 'var(--accent-green)' };
  return { label: '🔴 장마감', color: 'var(--accent-red)' };
}

// 한국: 상승=빨강, 하락=파랑 / 해외: 상승=초록, 하락=빨강
export default function StockClient({ initialStocks, briefing, briefingUS, exchangeHistory, themeHistory }: Props) {
  const [stocks, setStocks] = useState<Stock[]>(Array.isArray(initialStocks) ? initialStocks : []);
  const [mode, setMode] = useState<'domestic'|'global'>('domestic');
  const [domesticTab, setDomesticTab] = useState<'ranking'|'movers'|'sector'|'themes'|'news'|'calendar'|'watchlist'|'portfolio'>('ranking');
  const [globalTab, setGlobalTab] = useState<'ranking'|'movers'|'sector'|'news'|'m7'|'watchlist'|'portfolio'>('ranking');
  const [domesticMarket, setDomesticMarket] = useState<'ALL'|'KOSPI'|'KOSDAQ'>('ALL');
  const [moversTab, setMoversTab] = useState<'up'|'down'|'volume'>('up');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [stockListLimit, setStockListLimit] = useState(30);
  const [exchangeRate, setExchangeRate] = useState(1500);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<'list'|'card'>('card');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [news, setNews] = useState<Record<string, any>[]>([]);
  const [briefingOpen, setBriefingOpen] = useState(true);

  const LS_WATCHLIST_KEY = 'kd_stock_watchlist';

  useEffect(() => {
    fetch('/api/stock/themes').then(r => r.ok ? r.json() : null).then(d => { if (d?.themes) setThemes(d.themes); }).catch(() => {});
    fetch('/api/stock/calendar').then(r => r.ok ? r.json() : null).then(d => { if (d?.events) setCalendarEvents(d.events); }).catch(() => {});
    // 관심종목: API → localStorage 폴백
    fetch('/api/stock/watchlist').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.symbols?.length) { setWatchlistSymbols(d.symbols); }
      else { try { const ls = JSON.parse(localStorage.getItem(LS_WATCHLIST_KEY) || '[]'); if (Array.isArray(ls)) setWatchlistSymbols(ls); } catch {} }
    }).catch(() => { try { const ls = JSON.parse(localStorage.getItem(LS_WATCHLIST_KEY) || '[]'); if (Array.isArray(ls)) setWatchlistSymbols(ls); } catch {} });
    fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).then(d => { if (d?.rates?.KRW) setExchangeRate(d.rates.KRW); }).catch(() => {});
    // 뉴스 로드 (최신 20건)
    fetch('/api/stock/news-feed').then(r => r.ok ? r.json() : null).then(d => { if (d?.news) setNews(d.news); }).catch(() => {});
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
      if (data?.length) setStocks(data as unknown as Stock[]);
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

  // 스파크라인: 전체 종목 로드 (시가총액순 상위 60개 + 관심종목)
  useEffect(() => {
    const allSymbols = [...new Set([
      ...stocks.filter(s => s.price > 0).slice(0, 150).map(s => s.symbol),
      ...watchlistSymbols,
    ])];
    if (!allSymbols.length) return;
    fetch(`/api/stock/sparkline?symbols=${allSymbols.join(',')}`)
      .then(r => r.json()).then(d => { if (d.data) setSparklines(d.data); }).catch(() => {});
  }, [stocks, watchlistSymbols]);

  const isDomestic = mode === 'domestic';
  const domesticStocks = useMemo(() => stocks.filter(s => (s.market === 'KOSPI' || s.market === 'KOSDAQ') && !isIdx(s)), [stocks]);
  const globalStocks = useMemo(() => stocks.filter(s => (s.market === 'NYSE' || s.market === 'NASDAQ') && !isIdx(s)), [stocks]);
  const indexStocks = useMemo(() => stocks.filter(s => isIdx(s)), [stocks]);

  // Market sentiment
  const sentimentStocks = isDomestic ? domesticStocks : globalStocks;
  const upCount = sentimentStocks.filter(s => (s.change_pct ?? 0) > 0).length;
  const downCount = sentimentStocks.filter(s => (s.change_pct ?? 0) < 0).length;
  const flatCount = sentimentStocks.length - upCount - downCount;
  const sentTotal = sentimentStocks.length || 1;

  // Filter and sort
  function getFilteredStocks() {
    let list = isDomestic ? domesticStocks : globalStocks;
    if (!showInactive) list = list.filter(s => s.price > 0);
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
    });
  }

  const inactiveCount = (isDomestic ? domesticStocks : globalStocks).filter(s => s.price === 0).length;
  const filteredStocks = getFilteredStocks();
  const currentTab = isDomestic ? domesticTab : globalTab;
  const displayStocks = currentTab === 'ranking' ? filteredStocks.slice(0, stockListLimit) : filteredStocks;

  const toggleWatchlist = useCallback(async (symbol: string) => {
    const isWatched = watchlistSymbols.includes(symbol);
    const newList = isWatched ? watchlistSymbols.filter(s => s !== symbol) : [...watchlistSymbols, symbol];
    setWatchlistSymbols(newList);
    try { localStorage.setItem(LS_WATCHLIST_KEY, JSON.stringify(newList)); } catch {}
    try {
      await fetch('/api/stock/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, action: isWatched ? 'remove' : 'add' }),
      });
    } catch {}
  }, [watchlistSymbols]);

  const StockRow = useCallback(({ s, rank }: { s: Stock; rank: number }) => {
    const pct = s.change_pct ?? 0;
    const isGlobal = s.currency === 'USD';
    const isWatched = watchlistSymbols.includes(s.symbol);
    const isStale = pct === 0 && (s.change_amt ?? 0) === 0;
    const upColor = isGlobal ? 'var(--accent-green)' : 'var(--accent-red)';
    const downColor = isGlobal ? 'var(--accent-red)' : 'var(--accent-blue)';
    const barColor = pct > 0 ? upColor : pct < 0 ? downColor : 'var(--border)';
    const pts = sparklines[s.symbol];
    const isNearHigh = pts?.length >= 2 && pts[pts.length-1] >= Math.max(...pts) * 0.99;
    const isNearLow = pts?.length >= 2 && pts[pts.length-1] <= Math.min(...pts) * 1.01;
    // fill 스파크라인
    const sparkEl = pts?.length >= 2 ? (() => {
      const min = Math.min(...pts); const max = Math.max(...pts); const range = max - min || 1;
      const W = 48; const H = 22;
      const coords = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - 2 - ((v - min) / range) * (H - 4)]);
      const line = coords.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      const fillPath = `M${coords[0][0].toFixed(1)},${H} ` + coords.map(([x,y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${coords[coords.length-1][0].toFixed(1)},${H}Z`;
      const fillCol = pct > 0 ? (isGlobal ? 'rgba(46,232,165,0.12)' : 'rgba(255,107,107,0.12)') : pct < 0 ? (isGlobal ? 'rgba(248,113,113,0.12)' : 'rgba(108,180,255,0.12)') : 'rgba(148,163,184,0.08)';
      const lastX = coords[coords.length-1][0].toFixed(1);
      const lastY = coords[coords.length-1][1].toFixed(1);
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0, display: 'block' }}>
          <path d={fillPath} fill={fillCol} />
          <polyline points={line} fill="none" stroke={barColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={lastX} cy={lastY} r="2.5" fill={barColor} />
        </svg>
      );
    })() : null;
    return (
      <Link href={`/stock/${encodeURIComponent(s.symbol)}`} onClick={e => e.stopPropagation()} className="kd-feed-card" style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
        padding: '10px 4px 10px 0',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', transition: 'background 0.12s',
        textDecoration: 'none', color: 'inherit',
      }}>
        {/* 좌측 컬러 바 */}
        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: barColor, flexShrink: 0, minHeight: 36 }} />
        {/* 순위 */}
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', minWidth: 14, textAlign: 'center', fontFamily: 'monospace' }}>{rank}</span>
        {/* 관심 */}
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(s.symbol); }} className={isWatched ? 'animate-like' : ''} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 14, lineHeight: 1, color: isWatched ? 'var(--accent-yellow)' : 'var(--text-tertiary)', flexShrink: 0 }}>
          {isWatched ? '★' : '☆'}
        </button>
        {/* 종목명 + 메타 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>{s.name}</span>
            {Math.abs(pct) >= 10 && (
              <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: pct > 0 ? upColor : downColor, color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                {pct > 0 ? '급등' : '급락'}
              </span>
            )}
            {isNearHigh && !isNearLow && (
              <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'rgba(251,191,36,0.15)', color: '#D97706', fontWeight: 700, flexShrink: 0 }}>🔝신고</span>
            )}
            {isNearLow && (
              <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'rgba(108,180,255,0.12)', color: 'var(--accent-blue)', fontWeight: 700, flexShrink: 0 }}>📉신저</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0, fontFamily: 'monospace' }}>{s.symbol}</span>
            {s.sector && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>{s.sector}</span>}
            {s.market_cap > 0 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{fmtCap(s.market_cap, s.currency)}</span>}
          </div>
          {/* 거래량 바 */}
          {s.volume > 0 && (() => {
            const maxVol = isGlobal ? 80000000 : 50000000;
            const barW = Math.min((s.volume / maxVol) * 100, 100);
            return (
              <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barW}%`, background: barColor, opacity: 0.45, borderRadius: 1 }} />
              </div>
            );
          })()}
        </div>
        {/* fill 스파크라인 */}
        {sparkEl}
        {/* 가격 + 등락 */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 84 }}>
          {s.price === 0 ? (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>미제공</span>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px', marginBottom: 1 }}>
                {isGlobal ? `$${s.price?.toFixed(2)}` : `₩${fmt(s.price)}`}
              </div>
              {isGlobal && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 1 }}>≈₩{Math.round(s.price * exchangeRate).toLocaleString()}</div>}
              {isStale ? (
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>마감</div>
              ) : (
                <div style={{ fontSize: 12, fontWeight: 900, color: stockColor(pct, !isGlobal) }}>
                  {pct > 0 ? '▲' : pct < 0 ? '▼' : ''} {Math.abs(pct).toFixed(2)}%
                </div>
              )}
            </>
          )}
        </div>
      </Link>
    );
  }, [watchlistSymbols, toggleWatchlist, sparklines, exchangeRate]);

  const domesticTabs = [['ranking','시총'],['movers','등락률'],['sector','섹터'],['themes','테마'],['watchlist','관심']] as const;
  const globalTabs = [['ranking','시총'],['movers','등락률'],['sector','섹터'],['m7','M7'],['watchlist','관심']] as const;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      {/* ══════════════════════════════════════════
          헤더 + 히어로 AI시황 + 토글 + 지수 + 이슈 + 탭
          ══════════════════════════════════════════ */}

      {/* ─ 헤더 ─ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px' }}>📊 주식</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
          {(() => {
            const ms = getMarketStatus();
            const lastUpdate = stocks.length > 0 ? stocks.reduce((latest, s) => s.updated_at > latest ? s.updated_at : latest, stocks[0].updated_at) : null;
            return (
              <span style={{ fontSize: 10, fontWeight: 600, color: ms.color, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius-xl)', background: `${ms.color}12`, border: `1px solid ${ms.color}30` }}>
                {ms.label.includes('장중') && (
                  <span className="kd-pulse-dot" style={{ background: ms.color, flexShrink: 0 }} />
                )}
                {ms.label}
                {lastUpdate && <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 400, fontFamily: 'monospace' }}>{new Date(lastUpdate).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
              </span>
            );
          })()}
          <Link href="/stock/compare" className="kd-action-link" style={{ fontSize: 11 }}>⚔️ 비교</Link>
          <button onClick={() => refresh()} aria-label="새로고침" style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'border-color var(--transition-fast)' }} title="시세 새로고침">🔄</button>
        </div>
      </div>

      {/* ─ 히어로: AI 시황 카드 (그리드 배경 + KPI 4개) ─ */}
      {briefing && (() => {
        const bull = briefing.sentiment === 'bullish';
        const bear = briefing.sentiment === 'bearish';
        // 실제 상승/하락 비율 기반 심리지수 (Math.random 제거)
        const activeStocks = sentimentStocks.filter(s => s.change_pct !== 0 && s.price > 0);
        const upRatio = activeStocks.length > 0 ? activeStocks.filter(s => s.change_pct > 0).length / activeStocks.length : 0.5;
        const fgScore = Math.round(upRatio * 100);
        const fgLabel = fgScore >= 75 ? '극단탐욕' : fgScore >= 55 ? '탐욕' : fgScore >= 45 ? '중립' : fgScore >= 25 ? '공포' : '극단공포';
        const fgColor = fgScore >= 55 ? 'var(--accent-red)' : fgScore >= 45 ? 'var(--text-tertiary)' : 'var(--accent-blue)';
        const kospiIdx = indexStocks.find(s => s.name.includes('KOSPI') || s.symbol.includes('KOSPI'));
        const kospiPct = kospiIdx?.change_pct ?? 0;
        return (
          <div style={{ borderRadius: 'var(--radius-lg)', padding: '14px 14px 12px', marginBottom: 'var(--sp-md)', background: 'linear-gradient(140deg, #0D1F42 0%, #081228 60%, #0A1830 100%)', border: '1px solid #1A2A44', position: 'relative', overflow: 'hidden' }}>
            {/* 그리드 배경 */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.035, backgroundImage: 'repeating-linear-gradient(0deg,#4A9EFF 0,#4A9EFF 1px,transparent 1px,transparent 22px),repeating-linear-gradient(90deg,#4A9EFF 0,#4A9EFF 1px,transparent 1px,transparent 22px)' }} />
            {/* 헤더 */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-md)', cursor: 'pointer' }} onClick={() => setBriefingOpen(v => !v)}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--brand)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 'var(--sp-xs)', fontFamily: 'monospace' }}>AI 시황 분석</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#E8F2FF', lineHeight: 1.25, letterSpacing: '-0.4px' }}>{briefing.title}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--radius-sm)', background: bull ? 'rgba(46,232,165,0.1)' : bear ? 'rgba(248,113,113,0.1)' : 'rgba(148,163,184,0.1)', border: `1px solid ${bull ? 'rgba(46,232,165,0.25)' : bear ? 'rgba(248,113,113,0.25)' : 'rgba(148,163,184,0.2)'}`, flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>{bull ? '🐂' : bear ? '🐻' : '😐'}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: bull ? 'var(--accent-green)' : bear ? 'var(--accent-red)' : 'var(--text-secondary)' }}>{bull ? '강세' : bear ? '약세' : '보합'}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{briefingOpen ? '▲' : '▼'}</span>
              </div>
            </div>
            {/* KPI 4개 */}
            {briefingOpen && (
              <div className="kd-grid-4" style={{ position: 'relative', gap: 6 }}>
                {[
                  { label: 'KOSPI', val: kospiIdx ? fmt(kospiIdx.price) : '—', chg: kospiPct, chgStr: `${kospiPct > 0 ? '▲' : '▼'}${Math.abs(kospiPct).toFixed(2)}%`, color: kospiPct > 0 ? 'var(--accent-red)' : 'var(--accent-blue)' },
                  { label: '심리지수', val: String(fgScore), chg: 0, chgStr: fgLabel, color: fgColor },
                  { label: '상승종목', val: String(upCount), chg: 1, chgStr: `전체 ${sentTotal}`, color: isDomestic ? 'var(--accent-red)' : 'var(--accent-green)' },
                  { label: 'USD/KRW', val: exchangeRate.toLocaleString('ko-KR', {maximumFractionDigits:0}), chg: 0, chgStr: '원', color: 'var(--text-tertiary)' },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '7px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.5px', marginBottom: 3, fontFamily: 'monospace' }}>{kpi.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#D8E8FF', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>{kpi.val}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, marginTop: 1, color: kpi.color }}>{kpi.chgStr}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─ 국내/해외 토글 (평균등락 + 비율바 + 수치) ─ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
        {[
          { active: isDomestic, flag: '🇰🇷', label: '국내주식', sub: 'KOSPI · KOSDAQ', stocks: domesticStocks, onClick: () => { setMode('domestic'); setSearch(''); setSectorFilter('all'); setStockListLimit(30); }, activeBorder: 'var(--brand)', activeBg: 'rgba(59,123,246,0.06)', activeShadow: '0 0 16px rgba(59,123,246,0.12)', upColor: 'var(--accent-red)', dnColor: 'var(--accent-blue)' },
          { active: !isDomestic, flag: '🇺🇸', label: '해외주식', sub: 'NYSE · NASDAQ', stocks: globalStocks, onClick: () => { setMode('global'); setSearch(''); setSectorFilter('all'); setStockListLimit(30); }, activeBorder: 'var(--brand)', activeBg: 'rgba(59,123,246,0.06)', activeShadow: '0 0 16px rgba(59,123,246,0.12)', upColor: 'var(--accent-green)', dnColor: 'var(--accent-red)' },
        ].map(({ active, flag, label, sub, stocks: mstocks, onClick, activeBorder, activeBg, activeShadow, upColor, dnColor }) => {
          const actives = mstocks.filter(s => s.price > 0);
          const up = actives.filter(s => (s.change_pct ?? 0) > 0).length;
          const dn = actives.filter(s => (s.change_pct ?? 0) < 0).length;
          const flat = actives.length - up - dn;
          const withPct = actives.filter(s => (s.change_pct ?? 0) !== 0);
          const avg = withPct.length ? withPct.reduce((s, st) => s + (st.change_pct ?? 0), 0) / withPct.length : 0;
          const total = actives.length || 1;
          return (
            <button key={label} onClick={onClick} style={{ borderRadius: 'var(--radius-card)', padding: '11px 12px 9px', cursor: 'pointer', textAlign: 'left', background: active ? activeBg : 'var(--bg-surface)', border: `${active ? '1.5px' : '1px'} solid ${active ? activeBorder : 'var(--border)'}`, boxShadow: active ? activeShadow : 'none', transition: 'all var(--transition-normal)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 7 }}>
                <div>
                  <div style={{ fontSize: 'var(--fs-md)', marginBottom: 2 }}>{flag}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub} · {actives.length}종</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, letterSpacing: '-0.5px', color: avg >= 0 ? upColor : dnColor }}>{avg >= 0 ? '+' : ''}{avg.toFixed(2)}%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>평균등락</div>
                </div>
              </div>
              {/* 비율 바 */}
              <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden', display: 'flex', marginBottom: 'var(--sp-xs)' }}>
                <div style={{ width: `${(up/total)*100}%`, background: upColor, transition: 'width 0.5s', borderRadius: '3px 0 0 3px' }} />
                <div style={{ width: `${(flat/total)*100}%`, background: 'var(--border)' }} />
                <div style={{ width: `${(dn/total)*100}%`, background: dnColor, transition: 'width 0.5s', borderRadius: '0 3px 3px 0' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 600, fontFamily: 'monospace' }}>
                <span style={{ color: upColor }}>▲{up}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>—{flat}</span>
                <span style={{ color: dnColor }}>▼{dn}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─ 지수 카드 (fill 스파크라인 + 좌측 컬러 보더) ─ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
        {indexStocks.filter(s => isDomestic ? (s.market === 'KOSPI' || s.market === 'KOSDAQ') : (s.market === 'NYSE' || s.market === 'NASDAQ')).slice(0, 3).map(s => {
          const pct = s.change_pct ?? 0;
          const ac = pct > 0 ? (isDomestic ? 'var(--accent-red)' : 'var(--accent-green)') : pct < 0 ? (isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)') : 'var(--text-tertiary)';
          const pts = sparklines[s.symbol];
          const hasPts = pts?.length >= 2;
          // fill 스파크라인 path 계산
          const sparkPath = hasPts ? (() => {
            const min = Math.min(...pts); const max = Math.max(...pts); const range = max - min || 1;
            const W = 70; const H = 20;
            const coords = pts.map((v, i) => [((i / (pts.length - 1)) * W).toFixed(1), (H - 2 - ((v - min) / range) * (H - 4)).toFixed(1)]);
            const line = coords.map(([x,y]) => `${x},${y}`).join(' ');
            const fill = `M${coords[0][0]},${H} ` + coords.map(([x,y]) => `L${x},${y}`).join(' ') + ` L${coords[coords.length-1][0]},${H}Z`;
            return { line, fill, lastX: coords[coords.length-1][0], lastY: coords[coords.length-1][1] };
          })() : null;
          return (
            <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '10px 10px 8px', borderLeft: `3px solid ${ac}`, border: `1px solid var(--border)`, borderLeftWidth: 3, borderLeftColor: ac, transition: 'all var(--transition-fast)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-xs)' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.5px', fontFamily: 'monospace' }}>{s.name}</div>
                  {sparkPath && (
                    <svg width="40" height="16" viewBox="0 0 70 20" style={{ flexShrink: 0 }}>
                      <path d={sparkPath.fill} fill={`${ac === 'var(--accent-red)' ? 'rgba(255,107,107' : ac === 'var(--accent-green)' ? 'rgba(46,232,165' : 'rgba(108,180,255'},0.1)`} />
                      <polyline points={sparkPath.line} fill="none" stroke={ac} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', marginBottom: 1 }}>
                  {s.currency === 'USD' ? `$${s.price?.toLocaleString('en', {maximumFractionDigits:0})}` : fmt(s.price)}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: ac }}>{pct > 0 ? '▲' : pct < 0 ? '▼' : ''} {Math.abs(pct).toFixed(2)}%</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ─ 글로벌 지표 pill 태그 ─ */}
      {(() => {
        const globalIndicators: { label: string; symbol: string }[] = [
          { label: 'USD/KRW', symbol: '' },
          { label: 'WTI', symbol: '' },
          { label: '금', symbol: 'GLD' },
          { label: 'BTC', symbol: '' },
        ];
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 9, padding: '3px 7px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              USD/KRW <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
            </span>
            {stocks.filter(s => ['GLD', 'USO', 'TQQQ', 'SOXL'].includes(s.symbol) && s.price > 0).slice(0, 4).map(s => {
              const pct = s.change_pct ?? 0;
              const color = pct > 0 ? 'var(--accent-green)' : pct < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)';
              return (
                <span key={s.symbol} style={{ fontSize: 9, padding: '3px 7px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {s.name.length > 6 ? s.symbol : s.name} <span style={{ fontWeight: 700, color, fontFamily: 'monospace' }}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* ─ 섹터 미니 히트맵 (항상 표시) ─ */}
      {(() => {
        const targetStocks = isDomestic
          ? stocks.filter(s => s.market !== 'NASDAQ' && s.market !== 'NYSE' && s.sector && s.price > 0 && s.change_pct !== 0)
          : stocks.filter(s => (s.market === 'NASDAQ' || s.market === 'NYSE') && s.sector && s.price > 0 && s.change_pct !== 0);
        const sectorMap: Record<string, number[]> = {};
        targetStocks.forEach(s => { (sectorMap[s.sector!] ??= []).push(s.change_pct ?? 0); });
        const sectors = Object.entries(sectorMap)
          .map(([name, pcts]) => ({ name, avg: pcts.reduce((a, b) => a + b, 0) / pcts.length, count: pcts.length }))
          .filter(s => s.count >= 2)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        if (!sectors.length) return null;
        return (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 'var(--sp-sm)' }}>
            {sectors.map(sec => {
              const isUp = sec.avg > 0;
              const intensity = Math.min(Math.abs(sec.avg) / 5, 1);
              const bg = isUp
                ? `rgba(${isDomestic ? '248,113,113' : '46,232,165'},${0.05 + intensity * 0.15})`
                : `rgba(${isDomestic ? '96,165,250' : '248,113,113'},${0.05 + intensity * 0.15})`;
              const color = isUp
                ? (isDomestic ? 'var(--accent-red)' : 'var(--accent-green)')
                : (isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)');
              return (
                <Link key={sec.name} href={`/stock/sector/${encodeURIComponent(sec.name)}`} style={{ textDecoration: 'none', fontSize: 10, padding: '4px 7px', borderRadius: 5, background: bg, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{sec.name}</span>
                  <span style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{isUp ? '+' : ''}{sec.avg.toFixed(1)}%</span>
                </Link>
              );
            })}
          </div>
        );
      })()}

      {/* ─ ⚡ 이슈 배너 ─ */}
      {(() => {
        const bigMovers = sentimentStocks.filter(s => Math.abs(s.change_pct ?? 0) >= 5 && s.price > 0).sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0)).slice(0, 3);
        if (!bigMovers.length) return null;
        return (
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 'var(--sp-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11 }}>⚡</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent-yellow)', letterSpacing: '1.5px', fontFamily: 'monospace' }}>이슈 종목</span>
            </div>
            {bigMovers.map((s, idx) => {
              const pct = s.change_pct ?? 0;
              const isUp = pct > 0;
              const isGlobal = s.currency === 'USD';
              const upColor = isGlobal ? 'var(--accent-green)' : 'var(--accent-red)';
              const dnColor = isGlobal ? 'var(--accent-red)' : 'var(--accent-blue)';
              const col = isUp ? upColor : dnColor;
              return (
                <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '8px 12px', borderBottom: idx < bigMovers.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.12s' }} className="kd-feed-card">
                  <div style={{ width: 3, height: 30, borderRadius: 2, background: col, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                      {Math.abs(pct) >= 10 && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 4px', borderRadius: 3, marginLeft: 5, background: isUp ? upColor : dnColor, color: '#fff' }}>{isUp ? '급등' : '급락'}</span>}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'monospace' }}>{s.symbol} · {s.sector}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{isGlobal ? `$${s.price?.toFixed(2)}` : `₩${fmt(s.price)}`}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: col }}>{isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%</div>
                  </div>
                </Link>
              );
            })}
          </div>
        );
      })()}

      {/* ─ 서브 탭 ─ */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-md)', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as any }}>
        {(isDomestic ? domesticTabs : globalTabs).map(([k, l]) => (
          <button key={k} onClick={() => { isDomestic ? setDomesticTab(k as typeof domesticTab) : setGlobalTab(k as typeof globalTab); }} aria-pressed={currentTab === k} style={{
            padding: '6px 14px', borderRadius: 16, border: currentTab === k ? 'none' : '1px solid var(--border)', cursor: 'pointer', flexShrink: 0, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
            background: currentTab === k ? 'var(--brand)' : 'transparent',
            color: currentTab === k ? '#fff' : 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
            fontFamily: 'inherit',
          }}>{l}</button>
        ))}
      </div>


      {/* 섹터 탭 — 히트맵 + 섹터 랭킹 */}
      {currentTab === 'sector' && (
        <div style={{ marginBottom: 'var(--sp-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>섹터별 등락률</div>
            <SectionShareButton section={isDomestic ? 'stock-kr' : 'stock-us'} label="주식 종목 한눈에 보기!" pagePath="/stock" />
          </div>
          {/* 섹터 랭킹 바 차트 */}
          {(() => {
            const targetStocks = isDomestic
              ? stocks.filter(s => s.market !== 'NASDAQ' && s.market !== 'NYSE' && s.sector && s.price > 0)
              : stocks.filter(s => (s.market === 'NASDAQ' || s.market === 'NYSE') && s.sector && s.price > 0);
            const sectorMap: Record<string, number[]> = {};
            targetStocks.forEach(s => {
              if (!sectorMap[s.sector!]) sectorMap[s.sector!] = [];
              sectorMap[s.sector!].push(s.change_pct ?? 0);
            });
            const sectorRanking = Object.entries(sectorMap)
              .map(([name, pcts]) => ({ name, avg: pcts.reduce((a,b)=>a+b,0)/pcts.length, count: pcts.length }))
              .filter(s => s.count >= 2)
              .sort((a,b) => b.avg - a.avg);
            const maxAbs = Math.max(...sectorRanking.map(s => Math.abs(s.avg)), 0.1);
            const upC = isDomestic ? 'var(--accent-red)' : 'var(--accent-green)';
            const downC = isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)';
            return (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 'var(--sp-sm)' }}>섹터 등락률</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {sectorRanking.map(sec => {
                    const isUp = sec.avg > 0;
                    const barW = Math.abs(sec.avg) / maxAbs * 48;
                    const color = isUp ? upC : downC;
                    const isSelected = sectorFilter === sec.name;
                    return (
                      <button key={sec.name} onClick={() => { setSectorFilter(isSelected ? 'all' : sec.name); isDomestic ? setDomesticTab('ranking') : setGlobalTab('ranking'); }} style={{ display: 'flex', alignItems: 'center', gap: 7, background: isSelected ? (isUp ? (isDomestic?'rgba(255,107,107,0.06)':'rgba(46,232,165,0.06)') : (isDomestic?'rgba(108,180,255,0.06)':'rgba(248,113,113,0.06)')) : 'transparent', borderRadius: 'var(--radius-xs)', padding: '3px 4px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s' }}>
                        <span style={{ fontSize: 10, color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)', minWidth: 52, flexShrink: 0, fontWeight: isSelected ? 700 : 400, textAlign: 'right' }}>{sec.name}</span>
                        <div style={{ flex: 1, height: 5, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                          {isUp
                            ? <div style={{ position: 'absolute', left: '50%', width: `${barW}%`, height: '100%', background: color, opacity: 0.85 }} />
                            : <div style={{ position: 'absolute', right: '50%', width: `${barW}%`, height: '100%', background: color, opacity: 0.85 }} />
                          }
                          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color, minWidth: 40, textAlign: 'left', flexShrink: 0, fontFamily: 'monospace' }}>{isUp?'+':''}{sec.avg.toFixed(2)}%</span>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0, fontFamily: 'monospace' }}>{sec.count}종</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {/* 시총 트리맵 */}
          <StockTreemap
            stocks={isDomestic
              ? stocks.filter(s => s.market !== 'NASDAQ' && s.market !== 'NYSE')
              : stocks.filter(s => s.market === 'NASDAQ' || s.market === 'NYSE')}
            isKR={isDomestic}
          />
          <SectorHeatmap
            stocks={isDomestic
              ? stocks.filter(s => s.market !== 'NASDAQ' && s.market !== 'NYSE')
              : stocks.filter(s => s.market === 'NASDAQ' || s.market === 'NYSE')}
            isKR={isDomestic}
          />
        </div>
      )}

      {/* 뉴스 탭 */}
      {currentTab === 'news' && (
        <div style={{ marginBottom: 'var(--sp-lg)' }}>
          {news.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📰</div>
              <div style={{ fontWeight: 700, marginBottom: 'var(--sp-xs)' }}>뉴스를 수집 중입니다</div>
              <div style={{ fontSize: 13 }}>잠시 후 다시 확인해주세요</div>
            </div>
          ) : news.map((item: Record<string, any>) => {
            const sent = item.sentiment_label;
            const sentColor = sent === 'positive' ? 'var(--accent-green)' : sent === 'negative' ? 'var(--accent-red)' : 'var(--text-tertiary)';
            const sentLabel = sent === 'positive' ? '긍정' : sent === 'negative' ? '부정' : '중립';
            const stock = stocks.find(s => s.symbol === item.symbol);
            return (
              <a key={item.id} href={item.url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', marginBottom: 'var(--sp-sm)' }}>
                <div style={{ padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', background: 'var(--bg-surface)', borderLeft: `3px solid ${sent === 'positive' ? (isDomestic?'var(--accent-red)':'var(--accent-green)') : sent === 'negative' ? (isDomestic?'var(--accent-blue)':'var(--accent-red)') : 'var(--border)'}`, transition: 'border-color var(--transition-fast)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-sm)', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{item.title}</div>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: sent === 'positive' ? 'rgba(52,211,153,0.12)' : sent === 'negative' ? 'rgba(248,113,113,0.12)' : 'var(--bg-hover)', color: sentColor, fontWeight: 700, flexShrink: 0 }}>{sentLabel}</span>
                  </div>
                  {item.ai_summary && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--sp-sm)', padding: '6px 8px', background: 'var(--bg-hover)', borderRadius: 6 }}>{item.ai_summary}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {stock && (
                      <span style={{ fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-bg)', padding: '1px 6px', borderRadius: 4 }}>{stock.name}</span>
                    )}
                    <span>{item.source}</span>
                    <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{item.published_at ? new Date(item.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* 캘린더 탭 */}
      {isDomestic && domesticTab === 'calendar' && (
        <div style={{ marginBottom: 'var(--sp-lg)' }}>
          {calendarEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 'var(--sp-md)' }}>📅</div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>예정된 이벤트가 없습니다</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>실적 발표, 배당, IPO 등 주요 일정이 등록되면 표시됩니다</div>
            </div>
          ) :
          calendarEvents.map(ev => (
            <div key={ev.id} style={{ display: 'flex', gap: 'var(--sp-md)', padding: 'var(--sp-md) var(--card-p)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 6, alignItems: 'center' }}>
              <div style={{ textAlign: 'center', flexShrink: 0, width: 44 }}>
                <div className="text-xs-tertiary">{new Date(ev.event_date).toLocaleDateString('ko-KR',{month:'short'})}</div>
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
        <div style={{ marginBottom: 'var(--sp-lg)' }}>
          {/* 테마 필터 칩 */}
          <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button onClick={() => setSelectedTheme(null)} style={{ padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: !selectedTheme ? 'var(--brand)' : 'var(--bg-hover)', color: !selectedTheme ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>전체</button>
            {themes.map(t => (
              <button key={t.id} onClick={() => setSelectedTheme(selectedTheme === t.theme_name ? null : t.theme_name)} style={{ padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: selectedTheme === t.theme_name ? 'var(--brand)' : 'var(--bg-hover)', color: selectedTheme === t.theme_name ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>{t.is_hot ? '🔥' : ''}{t.theme_name}</button>
            ))}
          </div>
          {themes.filter(t => !selectedTheme || t.theme_name === selectedTheme).map(t => {
            const th = themeHistory?.find((h: Record<string, any>) => h.theme_name === t.theme_name);
            return (
            <div key={t.id} style={{ padding: 14, background: 'var(--bg-surface)', border: selectedTheme === t.theme_name ? '2px solid var(--brand)' : '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-sm)', overflow: 'hidden', position: 'relative' }}>
              {/* 등락 배경 */}
              <div style={{ position: 'absolute', inset: 0, background: (t.change_pct??0) > 0 ? 'linear-gradient(135deg, rgba(248,113,113,0.04), transparent)' : (t.change_pct??0) < 0 ? 'linear-gradient(135deg, rgba(96,165,250,0.04), transparent)' : 'transparent', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-sm)', position: 'relative' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t.is_hot&&'🔥 '}{t.theme_name}</span>
                    {selectedTheme === t.theme_name && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--brand)', color: '#fff', fontWeight: 700 }}>선택</span>}
                  </div>
                  {(th?.avg_change_rate != null || th?.prev_change_pct != null) && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전일 {(Number(th.avg_change_rate ?? th.prev_change_pct) > 0 ? '+' : '')}{Number(th.avg_change_rate ?? th.prev_change_pct).toFixed(1)}%</span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: stockColor(t.change_pct??0, true), fontVariantNumeric: 'tabular-nums' }}>{(t.change_pct??0)>0?'+':''}{(t.change_pct??0).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t.related_symbols?.length ?? 0}종목</div>
                </div>
              </div>
              {t.description && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>{t.description}</div>}
              {/* Related stocks mini list */}
              {t.related_symbols?.slice(0, 3).map(sym => {
                const rs = stocks.find(s => s.symbol === sym);
                if (!rs) return null;
                return (
                  <Link key={sym} href={`/stock/${sym}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-xs)', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', fontSize: 11, textDecoration: 'none', color: 'var(--text-secondary)', marginRight: 4 }}>
                    {rs.name} <span style={{ color: stockColor(rs.change_pct ?? 0, isDomestic), fontWeight: 700 }}>{(rs.change_pct ?? 0) > 0 ? '+' : ''}{(rs.change_pct ?? 0).toFixed(1)}%</span>
                  </Link>
                );
              })}
              {/* 테마 추이 스파크라인 */}
              {th?.history && Array.isArray(th.history) && th.history.length >= 2 && (() => {
                const vals = th.history.map((h: Record<string, any>) => Number(h.change_pct || h.avg_change_rate || 0));
                const min = Math.min(...vals); const max = Math.max(...vals);
                const range = max - min || 1; const W = 200; const H = 30; const P = 2;
                const points = vals.map((v: number, i: number) => `${P + (i / (vals.length - 1)) * (W - P * 2)},${H - P - ((v - min) / range) * (H - P * 2)}`).join(' ');
                const isUp = vals[vals.length - 1] >= vals[0];
                return (
                  <div style={{ marginBottom: 'var(--sp-sm)' }}>
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
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {t.related_symbols.map(sym => {
                    const st = stocks.find(s => s.symbol === sym);
                    if (!st) return null;
                    const rPct = st.change_pct ?? 0;
                    const rColor = rPct > 0 ? (isDomestic ? 'var(--accent-red)' : 'var(--accent-green)') : rPct < 0 ? (isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)') : 'var(--text-tertiary)';
                    return (
                      <Link key={sym} href={`/stock/${encodeURIComponent(sym)}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: `1px solid ${rPct !== 0 ? rColor + '40' : 'var(--border)'}`, textDecoration: 'none' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{st.name}</span>
                        <span style={{ fontWeight: 700, color: rColor }}>{rPct > 0 ? '+' : ''}{rPct.toFixed(1)}%</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      {/* M7 카드 (해외) */}
      {!isDomestic && globalTab === 'm7' && (() => {
        const m7Stocks = M7.map(sym => stocks.find(s => s.symbol === sym)).filter(Boolean) as Stock[];
        const totalCap = m7Stocks.reduce((s, st) => s + (st.market_cap || 0), 0);
        const maxCap = Math.max(...m7Stocks.map(st => st.market_cap || 0));
        const upCount7 = m7Stocks.filter(st => (st.change_pct ?? 0) > 0).length;
        const downCount7 = m7Stocks.filter(st => (st.change_pct ?? 0) < 0).length;
        return (
        <div style={{ marginBottom: 14 }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>🏆 Magnificent 7</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>합산 시총 {fmtCap(totalCap, 'USD')} · <span style={{ color: 'var(--accent-green)' }}>▲{upCount7}</span> <span style={{ color: 'var(--accent-red)' }}>▼{downCount7}</span></div>
            </div>
          </div>
          {/* 카드 그리드 */}
          <div className="listing-grid-2col">
            {m7Stocks.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).map((st) => {
              const pct = st.change_pct ?? 0;
              const color = pct > 0 ? 'var(--accent-green)' : pct < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)';
              const capPct = maxCap > 0 ? ((st.market_cap || 0) / maxCap) * 100 : 0;
              const pts = sparklines[st.symbol];
              return (
                <Link key={st.symbol} href={`/stock/${encodeURIComponent(st.symbol)}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: 'var(--sp-md) var(--card-p)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: `1px solid ${pct > 0 ? 'rgba(52,211,153,0.2)' : pct < 0 ? 'rgba(248,113,113,0.2)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', transition: 'all var(--transition-fast)', position: 'relative', overflow: 'hidden' }}>
                    {/* 시총 바 배경 */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${capPct}%`, background: pct > 0 ? 'rgba(52,211,153,0.04)' : pct < 0 ? 'rgba(248,113,113,0.04)' : 'transparent', transition: 'width 0.5s' }} />
                    {/* 좌측 */}
                    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{st.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{st.symbol}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ height: 4, width: `${capPct}%`, maxWidth: 120, background: pct > 0 ? 'rgba(52,211,153,0.5)' : pct < 0 ? 'rgba(248,113,113,0.5)' : 'var(--bg-hover)', borderRadius: 2 }} />
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtCap(st.market_cap, 'USD')}</span>
                      </div>
                    </div>
                    {/* 스파크라인 */}
                    {pts?.length >= 2 && <MiniSparkline data={pts} width={52} height={22} />}
                    {/* 가격 */}
                    <div style={{ textAlign: 'right', flexShrink: 0, position: 'relative' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>${st.price?.toFixed(2)}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* 등락률 서브탭 — segment control */}
      {currentTab === 'movers' && (
        <div>
          <div style={{ display: 'flex', gap: 0, marginBottom: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 3 }}>
            {([['up', isDomestic?'🔴 상승':'🟢 상승'],['down', isDomestic?'🔵 하락':'🔴 하락'],['volume','🔥 거래량']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setMoversTab(k)} style={{
                flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700,
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                background: moversTab===k ? (k==='up' ? (isDomestic?'var(--accent-red)':'var(--accent-green)') : k==='down' ? (isDomestic?'var(--accent-blue)':'var(--accent-red)') : 'var(--brand)') : 'transparent',
                color: moversTab===k ? '#fff' : 'var(--text-tertiary)',
                transition: 'all var(--transition-fast)',
              }}>{l}</button>
            ))}
          </div>
          {(() => {
            const targetStocks = isDomestic ? domesticStocks : globalStocks;
            const limitUp = isDomestic ? targetStocks.filter(s => (s.change_pct ?? 0) >= 29.5).length : 0;
            const limitDown = isDomestic ? targetStocks.filter(s => (s.change_pct ?? 0) <= -29.5).length : 0;
            const up5 = targetStocks.filter(s => (s.change_pct ?? 0) >= 5).length;
            const down5 = targetStocks.filter(s => (s.change_pct ?? 0) <= -5).length;
            const upColor = isDomestic ? 'var(--accent-red)' : 'var(--accent-green)';
            const downColor = isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)';
            if (limitUp === 0 && limitDown === 0 && up5 === 0 && down5 === 0) return null;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
                {up5 > 0 && (
                  <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: isDomestic ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)', border: `1px solid ${isDomestic ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}` }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{isDomestic ? '+5% 이상 상승' : '+5% Gainers'}</div>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: upColor }}>{up5}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 3 }}>종목</span></div>
                    {limitUp > 0 && <div style={{ fontSize: 10, marginTop: 2, color: upColor, fontWeight: 700 }}>🔺 상한가 {limitUp}종목</div>}
                  </div>
                )}
                {down5 > 0 && (
                  <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: isDomestic ? 'rgba(96,165,250,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${isDomestic ? 'rgba(96,165,250,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{isDomestic ? '-5% 이상 하락' : '-5% Losers'}</div>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: downColor }}>{down5}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 3 }}>종목</span></div>
                    {limitDown > 0 && <div style={{ fontSize: 10, marginTop: 2, color: downColor, fontWeight: 700 }}>🔻 하한가 {limitDown}종목</div>}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* 검색 + 시장 + 섹터 필터 한 줄 (시총/등락 탭) */}
      {currentTab !== 'calendar' && currentTab !== 'themes' && currentTab !== 'm7' && currentTab !== 'sector' && currentTab !== 'news' && currentTab !== 'portfolio' && currentTab !== 'watchlist' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
          {/* 검색 */}
          <div style={{ position: 'relative', flex: 1 }}>
            <input value={search} onChange={e => { setSearch(e.target.value); setStockListLimit(30); }}
              placeholder="종목명·코드 검색" aria-label="종목 검색" className="kd-search-input"
              style={{ paddingRight: search ? 28 : 10, width: '100%', boxSizing: 'border-box' }} />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, padding: 2 }} aria-label="닫기">✕</button>}
          </div>
          {/* 시장 (국내만) */}
          {isDomestic && currentTab === 'ranking' && (
            <select value={domesticMarket} onChange={e => setDomesticMarket(e.target.value as typeof domesticMarket)} style={{
              padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
            }}>
              <option value="ALL">전체</option>
              <option value="KOSPI">KOSPI</option>
              <option value="KOSDAQ">KOSDAQ</option>
            </select>
          )}
          {/* 섹터 */}
          {(currentTab === 'ranking' || currentTab === 'movers') && (() => {
            const targetStocks = isDomestic ? domesticStocks : globalStocks;
            const sectorSet = new Set(targetStocks.map(s => s.sector).filter((s): s is string => !!s));
            const sectorList = ['all', ...Array.from(sectorSet).sort()];
            if (sectorList.length < 3) return null;
            return (
              <select value={sectorFilter} onChange={e => { setSectorFilter(e.target.value); setStockListLimit(30); }} style={{
                padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0, maxWidth: 110,
              }}>
                {sectorList.map(s => <option key={s} value={s}>{s === 'all' ? '전체 섹터' : s}</option>)}
              </select>
            );
          })()}
          {/* 시세 미제공 */}
          {inactiveCount > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ accentColor: 'var(--brand)', width: 13, height: 13 }} />
              미제공 {inactiveCount}
            </label>
          )}
          {/* 뷰 모드 토글 */}
          {currentTab === 'ranking' && (
            <button onClick={() => setViewMode(v => v === 'list' ? 'card' : 'list')} title={viewMode === 'list' ? '카드뷰' : '리스트뷰'} style={{
              width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'border-color var(--transition-fast)',
            }}>
              {viewMode === 'list' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* 포트폴리오 탭 */}
      {currentTab === 'portfolio' && (
        <div>
          {/* 글로벌 파노라마 */}
          <GlobalPanorama
            stocks={stocks}
            exchangeRate={exchangeRate}
            briefingKR={briefing || null}
            briefingUS={briefingUS || null}
          />
          {/* 포트폴리오 시뮬레이터 */}
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 'var(--sp-sm)', marginTop: 'var(--sp-md)' }}>포트폴리오 시뮬레이터</div>
          <PortfolioSimulator stocks={stocks} isKR={isDomestic} />
          {/* 레이더 비교 */}
          <div style={{ marginTop: 'var(--sp-sm)' }}>
            <StockRadarChart stocks={isDomestic ? domesticStocks : globalStocks} isKR={isDomestic} />
          </div>
          <PortfolioTab />
        </div>
      )}

      {/* 시총 탭 — TOP3 하이라이트 카드 */}
      {currentTab === 'ranking' && filteredStocks.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginBottom: 10 }}>
          {filteredStocks.slice(0, 3).map((s, i) => {
            const pct = s.change_pct ?? 0;
            const isGlobal = s.currency === 'USD';
            const upColor = isGlobal ? 'var(--accent-green)' : 'var(--accent-red)';
            const downColor = isGlobal ? 'var(--accent-red)' : 'var(--accent-blue)';
            const color = pct > 0 ? upColor : pct < 0 ? downColor : 'var(--text-tertiary)';
            const medals = ['🥇','🥈','🥉'];
            return (
              <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '10px 10px 8px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)', border: `1.5px solid ${pct > 0 ? (isGlobal ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)') : pct < 0 ? (isGlobal ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.25)') : 'var(--border)'}`,
                  transition: 'border-color var(--transition-fast)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-xs)' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{medals[i]} {s.market}</span>
                    {sparklines[s.symbol]?.length >= 2 && <MiniSparkline data={sparklines[s.symbol]} width={32} height={14} />}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginBottom: 1 }}>
                    {isGlobal ? `$${s.price?.toFixed(1)}` : `₩${fmt(s.price)}`}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 종목 리스트 */}
      {currentTab !== 'calendar' && currentTab !== 'themes' && currentTab !== 'm7' && currentTab !== 'sector' && currentTab !== 'news' && currentTab !== 'portfolio' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '0 12px', overflow: 'hidden', position: 'relative' }}>
          {displayStocks.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              {currentTab === 'watchlist' ? (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ textAlign: 'center', marginBottom: 'var(--sp-lg)' }}>
                    <div style={{ fontSize: 36, marginBottom: 'var(--sp-sm)' }}>⭐</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-xs)' }}>관심종목을 추가해보세요</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>종목 목록에서 ☆ 버튼을 눌러 추가</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>
                    🔥 {isDomestic ? '국내 시총 TOP' : '해외 인기'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {(isDomestic ? domesticStocks : globalStocks).filter(s => s.price > 0).slice(0, 5).map(s => {
                      const pct = s.change_pct ?? 0;
                      const isGlobal = s.currency === 'USD';
                      const color = pct > 0 ? (isGlobal ? 'var(--accent-green)' : 'var(--accent-red)') : pct < 0 ? (isGlobal ? 'var(--accent-red)' : 'var(--accent-blue)') : 'var(--text-tertiary)';
                      return (
                        <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.symbol}</div>
                          </div>
                          <div style={{ textAlign: 'right', marginRight: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{isGlobal ? `$${s.price?.toFixed(2)}` : `₩${fmt(s.price)}`}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>
                          </div>
                          <button onClick={() => toggleWatchlist(s.symbol)} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                            ☆ 추가
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-tertiary)' }}>
                  {search ? `"${search}" 검색 결과가 없어요` : '데이터를 불러오는 중...'}
                  {search && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--sp-sm)' }}>종목명, 종목코드, 섹터로 검색해보세요</div>}
                </div>
              )}
            </div>
          ) : viewMode === 'card' && currentTab === 'ranking' ? (
              /* ── 카드뷰 ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-sm)' }}>
                {displayStocks.map((s) => {
                  const pct = s.change_pct ?? 0;
                  const isGlobal = s.currency === 'USD';
                  const isWatched = watchlistSymbols.includes(s.symbol);
                  const upColor = isGlobal ? 'var(--accent-green)' : 'var(--accent-red)';
                  const downColor = isGlobal ? 'var(--accent-red)' : 'var(--accent-blue)';
                  const priceColor = pct > 0 ? upColor : pct < 0 ? downColor : 'var(--text-tertiary)';
                  const pts = sparklines[s.symbol];
                  const sparkEl = pts?.length >= 2 ? (() => {
                    const min = Math.min(...pts); const max = Math.max(...pts); const range = max - min || 1;
                    const W = 60; const H = 24;
                    const coords = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - 2 - ((v - min) / range) * (H - 4)]);
                    const line = coords.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
                    const fillPath = `M${coords[0][0].toFixed(1)},${H} ` + coords.map(([x,y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${coords[coords.length-1][0].toFixed(1)},${H}Z`;
                    const fillCol = pct > 0 ? (isGlobal ? 'rgba(46,232,165,0.12)' : 'rgba(255,107,107,0.12)') : pct < 0 ? (isGlobal ? 'rgba(248,113,113,0.12)' : 'rgba(108,180,255,0.12)') : 'rgba(148,163,184,0.08)';
                    return (
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginTop: 6 }}>
                        <path d={fillPath} fill={fillCol} />
                        <polyline points={line} fill="none" stroke={priceColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    );
                  })() : null;
                  return (
                    <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} className="kd-section-card" style={{
                      display: 'block', padding: '12px', background: 'var(--bg-surface)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
                      textDecoration: 'none', color: 'inherit', position: 'relative',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-xs)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'monospace' }}>{s.symbol}{s.sector ? ` · ${s.sector}` : ''}</div>
                        </div>
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(s.symbol); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 14, color: isWatched ? 'var(--accent-yellow)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                          {isWatched ? '★' : '☆'}
                        </button>
                      </div>
                      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                        {s.price === 0 ? '—' : isGlobal ? `$${s.price?.toLocaleString('en', {minimumFractionDigits:2, maximumFractionDigits:2})}` : `₩${fmt(s.price)}`}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: priceColor, display: 'inline-block', padding: '1px 6px', borderRadius: 4, background: pct > 0 ? `${priceColor}12` : pct < 0 ? `${priceColor}12` : 'transparent', marginTop: 2 }}>
                        {pct > 0 ? '▲' : pct < 0 ? '▼' : '━'} {Math.abs(pct).toFixed(2)}%
                      </div>
                      {sparkEl}
                    </Link>
                  );
                })}
              </div>
            ) : displayStocks.map((s, i) => <StockRow key={s.symbol} s={s} rank={i + 1} />)}
          {/* 관심종목 탭: 오늘 수익률 요약 + 비교 바로가기 */}
          {currentTab === 'watchlist' && displayStocks.length > 0 && (() => {
            const up = displayStocks.filter(s => (s.change_pct ?? 0) > 0).length;
            const down = displayStocks.filter(s => (s.change_pct ?? 0) < 0).length;
            const avgPct = displayStocks.filter(s => s.price > 0).reduce((s, st) => s + (st.change_pct ?? 0), 0) / (displayStocks.filter(s => s.price > 0).length || 1);
            const upC = isDomestic ? 'var(--accent-red)' : 'var(--accent-green)';
            const downC = isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)';
            return (
              <div style={{ padding: '12px 0 14px', borderTop: '1px solid var(--border)', marginTop: 'var(--sp-xs)' }}>
                {/* 오늘 성과 요약 */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 3 }}>평균 등락</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: avgPct >= 0 ? upC : downC, fontVariantNumeric: 'tabular-nums' }}>{avgPct >= 0 ? '+' : ''}{avgPct.toFixed(2)}%</div>
                  </div>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 3 }}>상승</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: upC }}>{up}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 2 }}>종목</span></div>
                  </div>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 3 }}>하락</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: downC }}>{down}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 2 }}>종목</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <Link href="/stock/compare" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--brand-bg)', border: '1px solid var(--brand-border)' }}>
                    ⚔️ 관심종목 비교
                  </Link>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    총 {displayStocks.length}종목 관심
                  </span>
                </div>
              </div>
            );
          })()}
          {/* 더보기 버튼 (시총 탭) */}
          {currentTab === 'ranking' && filteredStocks.length > stockListLimit && (
            <button onClick={() => setStockListLimit(prev => prev + 30)} style={{
              display: 'block', width: '100%', padding: '14px 0', margin: '8px 0 12px',
              background: 'linear-gradient(135deg, var(--brand), #4F46E5)',
              border: 'none', borderRadius: 'var(--radius-md)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.3px',
              boxShadow: '0 2px 12px rgba(37,99,235,0.2)',
            }}>
              {filteredStocks.length - stockListLimit}종목 더 보기 →
            </button>
          )}
        </div>
      )}

      {/* 종목 비교 */}
      {(currentTab === 'ranking') && (() => {
        const krPairs: [string,string,string][] = [['005930','000660','삼성전자 vs SK하이닉스'],['005380','000270','현대차 vs 기아'],['373220','006400','LG에너지 vs 삼성SDI']];
        const usPairs: [string,string,string][] = [['AAPL','MSFT','Apple vs Microsoft'],['NVDA','AMD','NVIDIA vs AMD'],['GOOGL','META','Google vs Meta']];
        const pairs = isDomestic ? krPairs : usPairs;
        const valid = pairs.map(([a,b,t]) => { const sa=stocks.find(s=>s.symbol===a); const sb=stocks.find(s=>s.symbol===b); return sa&&sb?{sa,sb,t}:null; }).filter(Boolean) as {sa:Stock;sb:Stock;t:string}[];
        if (!valid.length) return null;
        const isKR = isDomestic;
        return (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>⚔️ 맞대결</div>
              <Link href="/stock/compare" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>더보기 →</Link>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              {valid.map(c => {
                const pctA = c.sa.change_pct ?? 0;
                const pctB = c.sb.change_pct ?? 0;
                const winner = Math.abs(pctA) > Math.abs(pctB) ? 'A' : Math.abs(pctB) > Math.abs(pctA) ? 'B' : null;
                const colorA = stockColor(pctA, isKR);
                const colorB = stockColor(pctB, isKR);
                const maxCap = Math.max(c.sa.market_cap || 0, c.sb.market_cap || 0) || 1;
                return (
                  <div key={c.t} style={{ minWidth: 240, padding: 'var(--sp-md) var(--card-p)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 10 }}>{c.t}</div>
                    {/* 종목 A */}
                    <Link href={`/stock/${encodeURIComponent(c.sa.symbol)}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-sm)', textDecoration: 'none', padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: winner === 'A' ? (pctA > 0 ? (isKR ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)') : (isKR ? 'rgba(96,165,250,0.06)' : 'rgba(248,113,113,0.06)')) : 'transparent' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.sa.name} {winner==='A'&&'👑'}</div>
                        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2, marginTop: 'var(--sp-xs)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${((c.sa.market_cap||0)/maxCap)*100}%`, background: colorA, borderRadius:2 }} />
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtCap(c.sa.market_cap, c.sa.currency)}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>{isKR ? `₩${fmt(c.sa.price)}` : `$${c.sa.price?.toFixed(2)}`}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colorA }}>{pctA>0?'+':''}{pctA.toFixed(2)}%</div>
                      </div>
                    </Link>
                    <div style={{ textAlign:'center', fontSize: 10, color: 'var(--text-tertiary)', margin: '2px 0 8px', fontWeight:600 }}>VS</div>
                    {/* 종목 B */}
                    <Link href={`/stock/${encodeURIComponent(c.sb.symbol)}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', textDecoration: 'none', padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: winner === 'B' ? (pctB > 0 ? (isKR ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)') : (isKR ? 'rgba(96,165,250,0.06)' : 'rgba(248,113,113,0.06)')) : 'transparent' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.sb.name} {winner==='B'&&'👑'}</div>
                        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2, marginTop: 'var(--sp-xs)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${((c.sb.market_cap||0)/maxCap)*100}%`, background: colorB, borderRadius:2 }} />
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtCap(c.sb.market_cap, c.sb.currency)}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>{isKR ? `₩${fmt(c.sb.price)}` : `$${c.sb.price?.toFixed(2)}`}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colorB }}>{pctB>0?'+':''}{pctB.toFixed(2)}%</div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 면책 */}
      <Disclaimer type="stock" compact />

      {/* 종목 모달 */}
      {selectedStock && (
        <StockDetailSheet
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          isDomestic={isDomestic}
          isWatched={watchlistSymbols.includes(selectedStock.symbol)}
          onToggleWatchlist={toggleWatchlist}
        />
      )}
    </div>
  );
}
