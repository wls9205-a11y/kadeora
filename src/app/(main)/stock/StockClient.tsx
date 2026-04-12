'use client';
import { stockColor, stockUpColor, stockDownColor, sentimentColor } from '@/lib/stockColor';
import { getStockLogo } from '@/lib/stockLogo';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import SearchInput from '@/components/SearchInput';
import dynamic from 'next/dynamic';

const PortfolioTab = dynamic(() => import('@/components/PortfolioTab'), { ssr: false });
const SectorHeatmap = dynamic(() => import('@/components/SectorHeatmap'), { ssr: false });
const StockDetailSheet = dynamic(() => import('./StockDetailSheet'), { ssr: false });
const StockTreemap = dynamic(() => import('@/components/StockTreemap'), { ssr: false });
const PortfolioSimulator = dynamic(() => import('@/components/PortfolioSimulator'), { ssr: false });
const GlobalPanorama = dynamic(() => import('@/components/GlobalPanorama'), { ssr: false });
const StockRadarChart = dynamic(() => import('@/components/StockRadarChart'), { ssr: false });
import MiniSparkline from '@/components/MiniSparkline';
import { fmtCap, fmt } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import SectionShareButton from '@/components/SectionShareButton';
import ExchangeRateMiniChart from '@/components/ExchangeRateMiniChart';
import TrendingKeywords from '@/components/TrendingKeywords';
import { isTossMode } from '@/lib/toss-mode';
import TossTeaser from '@/components/TossTeaser';

interface Stock {
  symbol: string; name: string; market: string; price: number; change_amt: number;
  change_pct: number; volume: number; market_cap: number; updated_at: string;
  currency?: string; sector?: string; description?: string; logo_url?: string;
}
interface Theme { id: number; theme_name: string; change_pct: number; is_hot: boolean; related_symbols?: string[]; description?: string; }
interface CalendarEvent { id: number; event_date: string; title: string; category: string; importance: string; description?: string; }
interface Props { initialStocks: Stock[]; briefing?: Record<string, any>; briefingUS?: Record<string, any>; exchangeHistory?: Record<string, any>[]; themeHistory?: Record<string, any>[]; }

const IDX_SYMBOLS = new Set(['KOSPI_IDX','KOSDAQ_IDX','SPY','QQQ','DIA','IWM','VOO','VTI','TQQQ','SQQQ','SOXL','SPXL','ARKK','GLD','SLV','TLT','USO','VNQ','SCHD','JEPI','XLK','XLF','XLE','XLV','KWEB','EEM','EWJ','EWY','FXI','UVXY']);
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
  if (kstMin >= 540 && kstMin <= 930) return { label: '🟢 장중', color: 'var(--stock-market-open)' };
  // US market: 22:30~05:00 KST (next day)
  if (kstMin >= 1350 || kstMin <= 300) return { label: '🟢 미국장중', color: 'var(--stock-market-open)' };
  return { label: '🔴 장마감', color: 'var(--stock-market-closed)' };
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
  const tossActive = typeof window !== 'undefined' && isTossMode();
  const displayStocks = tossActive ? filteredStocks.slice(0, 10) : (currentTab === 'ranking' ? filteredStocks.slice(0, stockListLimit) : filteredStocks);

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
    const upColor = stockUpColor(!isGlobal);
    const downColor = stockDownColor(!isGlobal);
    const barColor = pct > 0 ? upColor : pct < 0 ? downColor : 'var(--border)';
    const pts = sparklines[s.symbol];
    // 52주 위치 계산
    const w52h = pts?.length >= 2 ? Math.max(...pts) : null;
    const w52l = pts?.length >= 2 ? Math.min(...pts) : null;
    const w52pos = w52h && w52l && w52h !== w52l ? Math.round(((Number(s.price) - w52l) / (w52h - w52l)) * 100) : null;
    // fill 스파크라인
    const sparkEl = pts?.length >= 2 ? (() => {
      const min = Math.min(...pts); const max = Math.max(...pts); const range = max - min || 1;
      const W = 160; const H = 20;
      const coords = pts.map((v: number, i: number) => [(i / (pts.length - 1)) * W, H - 2 - ((v - min) / range) * (H - 4)]);
      const line = coords.map(([x,y]: number[]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      const fillPath = `M${coords[0][0].toFixed(1)},${H} ` + coords.map(([x,y]: number[]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${coords[coords.length-1][0].toFixed(1)},${H}Z`;
      const fillCol = pct > 0 ? (isGlobal ? 'rgba(46,232,165,0.08)' : 'rgba(255,107,107,0.08)') : pct < 0 ? (isGlobal ? 'rgba(248,113,113,0.08)' : 'rgba(108,180,255,0.08)') : 'rgba(148,163,184,0.05)';
      const last = coords[coords.length - 1];
      return (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <path d={fillPath} fill={fillCol} />
          <polyline points={line} fill="none" stroke={barColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last[0]} cy={last[1]} r="2" fill="var(--bg-base)" stroke={barColor} strokeWidth="1.5" />
        </svg>
      );
    })() : null;
    return (
      <Link href={`/stock/${encodeURIComponent(s.symbol)}`} className="kd-card-hover" style={{
        display: 'block', padding: '10px 10px 8px', borderRadius: 'var(--radius-card)',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        textDecoration: 'none', color: 'inherit', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${barColor}, ${barColor}40, transparent)` }} />
        {/* Row 1: Logo + Name + sector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0 }}>
            {(() => { const logo = getStockLogo(s.symbol, !isGlobal); return s.logo_url ? (
              <img src={s.logo_url} alt={`${s.name} 로고`} width={32} height={32} style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', objectFit: 'contain', flexShrink: 0, background: '#fff', padding: 2 }} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.removeProperty('display'); }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: logo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: logo.initials.length > 2 ? 8 : 11, fontWeight: 800, color: logo.textColor, letterSpacing: '-0.02em' }}>{logo.initials}</div>
            ); })()}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>{s.name}</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{s.symbol}</span>
                {s.sector && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: `${barColor}12`, color: barColor, fontWeight: 600 }}>{s.sector}</span>}
              </div>
            </div>
          </div>
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(s.symbol); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 14, color: isWatched ? 'var(--accent-yellow)' : 'var(--text-tertiary)', flexShrink: 0, opacity: isWatched ? 1 : 0.4 }}>
            {isWatched ? '★' : '☆'}
          </button>
        </div>
        {/* Row 2: Price + Change */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
            {s.price === 0 ? '—' : isGlobal ? `$${Number(s.price)?.toFixed(2)}` : fmt(Number(s.price))}
          </span>
          {Number(s.price) > 0 && (
            <span style={{ fontSize: 12, fontWeight: 800, color: isStale ? 'var(--text-tertiary)' : stockColor(pct, !isGlobal), padding: '1px 6px', borderRadius: 5, background: isStale ? 'var(--bg-hover)' : `${barColor}12` }}>
              {isStale ? '전일종가' : pct > 0 ? `▲ ${pct.toFixed(2)}%` : pct < 0 ? `▼ ${Math.abs(pct).toFixed(2)}%` : '전일종가'}
            </span>
          )}
        </div>
        {/* Row 3: Sparkline */}
        {sparkEl && <div style={{ marginBottom: 4 }}>{sparkEl}</div>}
        {/* Row 4: 52주 위치 바 */}
        {w52pos !== null && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 1 }}>
              <span>52주 저</span>
              <span>{w52pos}%</span>
              <span>52주 고</span>
            </div>
            <div style={{ height: 3, borderRadius: 4, background: 'var(--bg-hover)', position: 'relative' }}>
              <div style={{ height: '100%', width: `${w52pos}%`, borderRadius: 4, background: `linear-gradient(90deg, ${stockDownColor(isDomestic)}, ${barColor})` }} />
            </div>
          </div>
        )}
        {/* Row 5: Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
          {s.market_cap > 0 && <span>시총 {fmtCap(Number(s.market_cap), s.currency)}</span>}
          {s.volume > 0 && <span>{Number(s.volume) >= 1000000 ? (Number(s.volume) / 1000000).toFixed(1) + 'M' : Number(s.volume) >= 1000 ? Math.round(Number(s.volume) / 1000) + 'K' : Number(s.volume).toLocaleString()}</span>}
          {s.description && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{s.description.split('.')[0]}</span>}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-md)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>주식</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(() => {
            const ms = getMarketStatus();
            return (
              <span style={{ fontSize: 11, fontWeight: 600, color: ms.color, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 'var(--radius-card)', background: `${ms.color}12` }}>
                {ms.label.includes('장중') && (
                  <span className="kd-pulse-dot" style={{ background: ms.color, flexShrink: 0 }} />
                )}
                {ms.label.replace(/[🟢🔴⏸]/g, '').trim()}
              </span>
            );
          })()}
          <SectionShareButton section={isDomestic ? 'stock-kr' : 'stock-us'} label="주식 시황 한눈에 보기!" pagePath="/stock" />
        </div>
      </div>

      {/* ─ 주말 안내 배너 ─ */}
      {(() => {
        const ms = getMarketStatus();
        if (!ms.label.includes('휴장')) return null;
        const topPerformers = [...sentimentStocks].filter(s => s.price > 0 && s.change_pct !== 0).sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
        const topUp = topPerformers.filter(s => s.change_pct > 0).slice(0, 3);
        const topDown = topPerformers.filter(s => s.change_pct < 0).slice(0, 3);
        return (
          <div style={{ borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 'var(--sp-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>📅 주말 · 금요일 종가 기준</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>월요일 09:00 개장</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-hover)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: stockUpColor(isDomestic), marginBottom: 6 }}>주간 상승 TOP</div>
                {topUp.length > 0 ? topUp.map(s => (
                  <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{s.name}</span>
                    <span style={{ color: stockUpColor(isDomestic), fontWeight: 700 }}>+{s.change_pct.toFixed(1)}%</span>
                  </div>
                )) : <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>데이터 없음</div>}
              </div>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-hover)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: stockDownColor(isDomestic), marginBottom: 6 }}>주간 하락 TOP</div>
                {topDown.length > 0 ? topDown.map(s => (
                  <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{s.name}</span>
                    <span style={{ color: stockDownColor(isDomestic), fontWeight: 700 }}>{s.change_pct.toFixed(1)}%</span>
                  </div>
                )) : <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>데이터 없음</div>}
              </div>
            </div>
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(59,123,246,0.04)', border: '1px solid rgba(59,123,246,0.08)', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>💡 주말에도 종목 분석 · 포트폴리오 시뮬레이터를 이용해보세요</span>
            </div>
          </div>
        );
      })()}

      {/* ─ 히어로: AI 시황 카드 (그리드 배경 + KPI 4개) ─ */}
      {briefing && (() => {
        const bull = briefing.sentiment === 'bullish';
        const bear = briefing.sentiment === 'bearish';
        // 실제 상승/하락 비율 기반 심리지수 (Math.random 제거)
        const activeStocks = sentimentStocks.filter(s => s.change_pct !== 0 && s.price > 0);
        const upRatio = activeStocks.length > 0 ? activeStocks.filter(s => s.change_pct > 0).length / activeStocks.length : 0.5;
        const fgScore = Math.round(upRatio * 100);
        const fgLabel = fgScore >= 75 ? '극단탐욕' : fgScore >= 55 ? '탐욕' : fgScore >= 45 ? '중립' : fgScore >= 25 ? '공포' : '극단공포';
        const fgColor = fgScore >= 55 ? stockUpColor(isDomestic) : fgScore >= 45 ? 'var(--stock-flat)' : stockDownColor(isDomestic);
        const kospiIdx = indexStocks.find(s => s.symbol === 'KOSPI_IDX' || s.name.includes('KOSPI 지수'));
        const kospiPct = kospiIdx?.change_pct ?? 0;
        return (
          <div style={{ borderRadius: 'var(--radius-lg)', padding: '12px 14px 10px', marginBottom: 'var(--sp-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>AI 시황</span>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: bull ? 'var(--stock-bullish-bg)' : bear ? 'var(--stock-bearish-bg)' : 'var(--stock-neutral-bg)', color: bull ? 'var(--stock-bullish)' : bear ? 'var(--stock-bearish)' : 'var(--stock-neutral)', fontWeight: 700 }}>
                {bull ? '강세' : bear ? '약세' : '보합'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                {briefing.created_at ? new Date(briefing.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: 8 }}>{briefing.summary || briefing.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
              {(() => {
                const topUp = [...sentimentStocks].filter(s => s.change_pct > 0 && s.price > 0).sort((a, b) => b.change_pct - a.change_pct)[0];
                const topDn = [...sentimentStocks].filter(s => s.change_pct < 0 && s.price > 0).sort((a, b) => a.change_pct - b.change_pct)[0];
                return (
                  <>
                    <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>상승 TOP</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: stockUpColor(isDomestic), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topUp?.name || '—'}</div>
                    </div>
                    <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>하락 TOP</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: stockDownColor(isDomestic), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topDn?.name || '—'}</div>
                    </div>
                    <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>USD/KRW</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ─ 국내/해외 토글 (평균등락 + 비율바 + 수치) ─ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
        {[
          { active: isDomestic, flag: '🇰🇷', label: '국내주식', sub: 'KOSPI · KOSDAQ', stocks: domesticStocks, onClick: () => { setMode('domestic'); setSearch(''); setSectorFilter('all'); setStockListLimit(30); }, activeBorder: 'var(--brand)', activeBg: 'rgba(59,123,246,0.06)', activeShadow: '0 0 16px rgba(59,123,246,0.12)', upColor: stockUpColor(true), dnColor: stockDownColor(true) },
          { active: !isDomestic, flag: '🇺🇸', label: '해외주식', sub: 'NYSE · NASDAQ', stocks: globalStocks, onClick: () => { setMode('global'); setSearch(''); setSectorFilter('all'); setStockListLimit(30); }, activeBorder: 'var(--brand)', activeBg: 'rgba(59,123,246,0.06)', activeShadow: '0 0 16px rgba(59,123,246,0.12)', upColor: stockUpColor(false), dnColor: stockDownColor(false) },
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
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub} · {actives.length}종</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, letterSpacing: '-0.5px', color: avg >= 0 ? upColor : dnColor }}>{avg >= 0 ? '+' : ''}{avg.toFixed(2)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>평균등락</div>
                </div>
              </div>
              {/* 비율 바 */}
              <div style={{ height: 5, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', display: 'flex', marginBottom: 'var(--sp-xs)' }}>
                <div style={{ width: `${(up/total)*100}%`, background: upColor, transition: 'width 0.5s', borderRadius: '3px 0 0 3px' }} />
                <div style={{ width: `${(flat/total)*100}%`, background: 'var(--border)' }} />
                <div style={{ width: `${(dn/total)*100}%`, background: dnColor, transition: 'width 0.5s', borderRadius: '0 3px 3px 0' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}>
                <span style={{ color: upColor }}>▲{up}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>—{flat}</span>
                <span style={{ color: dnColor }}>▼{dn}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─ 지수 KPI 6열 (3×2 모바일, 6열 데스크탑) ─ */}
      <div className="kd-index-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, marginBottom: 'var(--sp-sm)' }}>
        {(() => {
          const kospi = indexStocks.find(s => s.symbol === 'KOSPI_IDX' || s.name.includes('KOSPI 지수'));
          const kosdaq = indexStocks.find(s => s.symbol === 'KOSDAQ_IDX' || s.name.includes('KOSDAQ 지수'));
          const sp500 = stocks.find(s => s.symbol === 'SPY');
          const nasdaq = stocks.find(s => s.symbol === 'QQQ');
          const gold = stocks.find(s => s.symbol === 'GLD');
          const indicators = [
            { label: 'KOSPI', val: kospi ? fmt(kospi.price) : '—', pct: kospi?.change_pct ?? 0, krStyle: true },
            { label: 'KOSDAQ', val: kosdaq ? fmt(kosdaq.price) : '—', pct: kosdaq?.change_pct ?? 0, krStyle: true },
            { label: 'S&P 500', val: sp500 ? Number(sp500.price).toLocaleString('en', { maximumFractionDigits: 0 }) : '—', pct: sp500?.change_pct ?? 0, krStyle: false },
            { label: 'NASDAQ', val: nasdaq ? Number(nasdaq.price).toLocaleString('en', { maximumFractionDigits: 0 }) : '—', pct: nasdaq?.change_pct ?? 0, krStyle: false },
            { label: 'USD/KRW', val: exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 }), pct: 0, krStyle: false },
            { label: '금(GLD)', val: gold ? '$' + Number(gold.price).toLocaleString('en', { maximumFractionDigits: 0 }) : '—', pct: gold?.change_pct ?? 0, krStyle: false },
          ];
          return indicators.map(ind => {
            const color = ind.pct > 0
              ? (ind.krStyle ? stockUpColor(true) : stockUpColor(false))
              : ind.pct < 0
                ? (ind.krStyle ? stockDownColor(true) : stockDownColor(false))
                : 'var(--text-tertiary)';
            return (
              <div key={ind.label} style={{ background: 'var(--bg-surface)', padding: '8px 8px', borderLeft: `3px solid ${color}`, borderRadius: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.3px' }}>{ind.label}</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{ind.val}</div>
                {ind.pct !== 0 && <div style={{ fontSize: 10, color, fontWeight: 700 }}>{ind.pct > 0 ? '▲' : '▼'}{Math.abs(ind.pct).toFixed(2)}%</div>}
              </div>
            );
          });
        })()}
      </div>

      {/* ─ 글로벌 지표 pill 태그 (확장) ─ */}
      {(() => {
        const pillStocks = stocks.filter(s => ['DIA','USO','TLT','TQQQ','SOXL','IWM'].includes(s.symbol) && s.price > 0);
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              USD/KRW <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
            </span>
            {pillStocks.map(s => {
              const pct = s.change_pct ?? 0;
              const color = pct > 0 ? stockUpColor(false) : pct < 0 ? stockDownColor(false) : 'var(--stock-flat)';
              const label = s.symbol === 'DIA' ? '다우' : s.symbol === 'USO' ? '원유' : s.symbol === 'TLT' ? '국채' : s.symbol === 'IWM' ? '러셀' : s.symbol;
              return (
                <span key={s.symbol} style={{ fontSize: 10, padding: '3px 7px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {label} <span style={{ fontWeight: 700, color, fontFamily: 'monospace' }}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* ─ 섹터 트리맵 (비대칭 그리드) ─ */}
      {(() => {
        const targetStocks = isDomestic
          ? stocks.filter(s => s.market !== 'NASDAQ' && s.market !== 'NYSE' && s.sector && s.price > 0 && s.change_pct !== 0)
          : stocks.filter(s => (s.market === 'NASDAQ' || s.market === 'NYSE') && s.sector && s.price > 0 && s.change_pct !== 0);
        const sectorMap: Record<string, { pcts: number[]; topName: string; topPct: number }> = {};
        targetStocks.forEach(s => {
          if (!sectorMap[s.sector!]) sectorMap[s.sector!] = { pcts: [], topName: '', topPct: 0 };
          sectorMap[s.sector!].pcts.push(s.change_pct ?? 0);
          if (Math.abs(s.change_pct ?? 0) > Math.abs(sectorMap[s.sector!].topPct)) {
            sectorMap[s.sector!].topName = s.name;
            sectorMap[s.sector!].topPct = s.change_pct ?? 0;
          }
        });
        const sectors = Object.entries(sectorMap)
          .map(([name, d]) => ({ name, avg: d.pcts.reduce((a, b) => a + b, 0) / d.pcts.length, count: d.pcts.length, topName: d.topName, topPct: d.topPct }))
          .filter(s => s.count >= 2)
          .sort((a, b) => b.count - a.count);
        if (sectors.length < 3) return null;
        const top5 = sectors.slice(0, 5);
        const rest = sectors.slice(5, 10);
        const upColor = stockUpColor(isDomestic);
        const dnColor = stockDownColor(isDomestic);
        const getColor = (avg: number) => avg > 0 ? upColor : dnColor;
        const getBg = (avg: number) => {
          const intensity = Math.min(Math.abs(avg) / 5, 1);
          return avg > 0
            ? `rgba(${isDomestic ? '248,113,113' : '46,232,165'},${0.04 + intensity * 0.14})`
            : `rgba(${isDomestic ? '96,165,250' : '248,113,113'},${0.04 + intensity * 0.14})`;
        };
        return (
          <div style={{ marginBottom: 'var(--sp-sm)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '36px 36px', gap: 2, borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 3 }}>
              <Link href={`/stock/sector/${encodeURIComponent(top5[0].name)}`} style={{ textDecoration: 'none', background: getBg(top5[0].avg), padding: '5px 8px', gridRow: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: getColor(top5[0].avg) }}>{top5[0].name}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: getColor(top5[0].avg) }}>{top5[0].avg > 0 ? '+' : ''}{top5[0].avg.toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{top5[0].topName} {top5[0].topPct > 0 ? '+' : ''}{top5[0].topPct.toFixed(1)}%</div>
              </Link>
              {top5.slice(1, 5).map(sec => (
                <Link key={sec.name} href={`/stock/sector/${encodeURIComponent(sec.name)}`} style={{ textDecoration: 'none', background: getBg(sec.avg), padding: '4px 6px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: getColor(sec.avg) }}>{sec.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: getColor(sec.avg) }}>{sec.avg > 0 ? '+' : ''}{sec.avg.toFixed(1)}%</div>
                </Link>
              ))}
            </div>
            {rest.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rest.length}, minmax(0, 1fr))`, gap: 2, borderRadius: 4, overflow: 'hidden' }}>
                {rest.map(sec => (
                  <Link key={sec.name} href={`/stock/sector/${encodeURIComponent(sec.name)}`} style={{ textDecoration: 'none', background: getBg(sec.avg), padding: '3px 2px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{sec.name}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: getColor(sec.avg) }}>{sec.avg > 0 ? '+' : ''}{sec.avg.toFixed(1)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─ ⚡ 이슈 종목 — 세분화 ─ */}
      {(() => {
        const allMovers = sentimentStocks.filter(s => s.price > 0);
        const isGlobal = !isDomestic;
        const upColor = stockUpColor(!isGlobal);
        const dnColor = stockDownColor(!isGlobal);

        // 카테고리별 분류
        const surgeUp = allMovers.filter(s => (s.change_pct ?? 0) >= 5).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0)).slice(0, 5);
        const surgeDn = allMovers.filter(s => (s.change_pct ?? 0) <= -5).sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0)).slice(0, 5);
        const highVol = [...allMovers].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).filter(s => Math.abs(s.change_pct ?? 0) >= 1).slice(0, 5);

        const categories = [
          { key: 'up', label: '급등', icon: '🔺', items: surgeUp, color: upColor },
          { key: 'dn', label: '급락', icon: '🔻', items: surgeDn, color: dnColor },
          { key: 'vol', label: '거래 폭증', icon: '📊', items: highVol, color: 'var(--accent-yellow)' },
        ].filter(c => c.items.length > 0);

        if (!categories.length) return null;
        return (
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 'var(--sp-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12 }}>⚡</span>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--accent-yellow)', letterSpacing: '1px' }}>이슈 종목</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{isDomestic ? '국내' : '해외'}</span>
            </div>
            {categories.map(cat => (
              <div key={cat.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                  <span style={{ fontSize: 11 }}>{cat.icon}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: cat.color }}>{cat.label}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{cat.items.length}종목</span>
                </div>
                {cat.items.map((s, idx) => {
                  const pct = s.change_pct ?? 0;
                  const isUp = pct > 0;
                  const col = isUp ? upColor : dnColor;
                  return (
                    <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '7px 12px', borderBottom: idx < cat.items.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.12s' }} className="kd-feed-card">
                      <div style={{ width: 3, height: 28, borderRadius: 4, background: col, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.name}
                          {Math.abs(pct) >= 15 && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 4px', borderRadius: 4, marginLeft: 5, background: col, color: '#fff' }}>{isUp ? '상한' : '하한'}</span>}
                          {Math.abs(pct) >= 10 && Math.abs(pct) < 15 && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 4px', borderRadius: 4, marginLeft: 5, background: col, color: '#fff' }}>{isUp ? '급등' : '급락'}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{s.symbol} · {s.sector || '-'}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.currency === 'USD' ? `$${s.price?.toFixed(2)}` : `₩${fmt(s.price)}`}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: col }}>{isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ─ 서브 탭 ─ */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-md)', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as any }}>
        {(isDomestic ? domesticTabs : globalTabs).map(([k, l]) => (
          <button key={k} onClick={() => { isDomestic ? setDomesticTab(k as typeof domesticTab) : setGlobalTab(k as typeof globalTab); }} aria-pressed={currentTab === k} style={{
            padding: '6px 14px', borderRadius: 'var(--radius-lg)', border: currentTab === k ? 'none' : '1px solid var(--border)', cursor: 'pointer', flexShrink: 0, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
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
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>섹터별 등락률</div>
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
            const upC = stockUpColor(isDomestic);
            const downC = stockDownColor(isDomestic);
            return (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 'var(--sp-sm)' }}>섹터 등락률</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sectorRanking.map(sec => {
                    const isUp = sec.avg > 0;
                    const barW = Math.abs(sec.avg) / maxAbs * 48;
                    const color = isUp ? upC : downC;
                    const isSelected = sectorFilter === sec.name;
                    return (
                      <button key={sec.name} onClick={() => { setSectorFilter(isSelected ? 'all' : sec.name); isDomestic ? setDomesticTab('ranking') : setGlobalTab('ranking'); }} style={{ display: 'flex', alignItems: 'center', gap: 7, background: isSelected ? (isUp ? (isDomestic?'rgba(255,107,107,0.06)':'rgba(46,232,165,0.06)') : (isDomestic?'rgba(108,180,255,0.06)':'rgba(248,113,113,0.06)')) : 'transparent', borderRadius: 'var(--radius-xs)', padding: '3px 4px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s' }}>
                        <span style={{ fontSize: 10, color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)', minWidth: 52, flexShrink: 0, fontWeight: isSelected ? 700 : 400, textAlign: 'right' }}>{sec.name}</span>
                        <div style={{ flex: 1, height: 5, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                          {isUp
                            ? <div style={{ position: 'absolute', left: '50%', width: `${barW}%`, height: '100%', background: color, opacity: 0.85 }} />
                            : <div style={{ position: 'absolute', right: '50%', width: `${barW}%`, height: '100%', background: color, opacity: 0.85 }} />
                          }
                          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color, minWidth: 40, textAlign: 'left', flexShrink: 0, fontFamily: 'monospace' }}>{isUp?'+':''}{sec.avg.toFixed(2)}%</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0, fontFamily: 'monospace' }}>{sec.count}종</span>
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
            const sentColor = sentimentColor(sent || 'neutral');
            const sentLabel = sent === 'positive' ? '긍정' : sent === 'negative' ? '부정' : '중립';
            const stock = stocks.find(s => s.symbol === item.symbol);
            return (
              <a key={item.id} href={item.url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', marginBottom: 'var(--sp-sm)' }}>
                <div style={{ padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', background: 'var(--bg-surface)', borderLeft: `3px solid ${sentimentColor(sent || 'neutral')}`, transition: 'border-color var(--transition-fast)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-sm)', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{item.title}</div>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: sent === 'positive' ? 'rgba(52,211,153,0.12)' : sent === 'negative' ? 'rgba(248,113,113,0.12)' : 'var(--bg-hover)', color: sentColor, fontWeight: 700, flexShrink: 0 }}>{sentLabel}</span>
                  </div>
                  {item.ai_summary && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--sp-sm)', padding: '6px 8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>{item.ai_summary}</div>}
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
                    {selectedTheme === t.theme_name && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--brand)', color: '#fff', fontWeight: 700 }}>선택</span>}
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
                  <Link key={sym} href={`/stock/${sym}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-xs)', padding: '3px 8px', borderRadius: 4, background: 'var(--bg-hover)', fontSize: 11, textDecoration: 'none', color: 'var(--text-secondary)', marginRight: 4 }}>
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
                      <polyline points={points} fill="none" stroke={stockColor(isUp ? 1 : -1, isDomestic)} strokeWidth="1.5" strokeLinecap="round" />
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
                    if (!st) return null;
                    const rPct = st.change_pct ?? 0;
                    const rColor = stockColor(rPct, isDomestic);
                    return (
                      <Link key={sym} href={`/stock/${encodeURIComponent(sym)}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: `1px solid ${rPct !== 0 ? rColor + '40' : 'var(--border)'}`, textDecoration: 'none' }}>
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
        <div style={{ marginBottom: 'var(--sp-md)' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>🏆 Magnificent 7</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>합산 시총 {fmtCap(totalCap, 'USD')} · <span style={{ color: stockUpColor(false) }}>▲{upCount7}</span> <span style={{ color: stockDownColor(false) }}>▼{downCount7}</span></div>
            </div>
          </div>
          {/* 카드 그리드 */}
          <div className="listing-grid-2col">
            {m7Stocks.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).map((st) => {
              const pct = st.change_pct ?? 0;
              const color = pct > 0 ? stockUpColor(false) : pct < 0 ? stockDownColor(false) : 'var(--stock-flat)';
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
                        <div style={{ height: 4, width: `${capPct}%`, maxWidth: 120, background: pct > 0 ? 'rgba(52,211,153,0.5)' : pct < 0 ? 'rgba(248,113,113,0.5)' : 'var(--bg-hover)', borderRadius: 4 }} />
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
                background: moversTab===k ? (k==='up' ? stockUpColor(isDomestic) : k==='down' ? stockDownColor(isDomestic) : 'var(--brand)') : 'transparent',
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
            const upColor = stockUpColor(isDomestic);
            const downColor = stockDownColor(isDomestic);
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
          <SearchInput
            value={search}
            onChange={v => { setSearch(v); setStockListLimit(30); }}
            placeholder="종목명, 코드 검색"
            size="sm"
            style={{ flex: 1 }}
          />
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
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 'var(--sp-sm)', marginTop: 'var(--sp-md)' }}>포트폴리오 시뮬레이터</div>
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
            const upColor = stockUpColor(!isGlobal);
            const downColor = stockDownColor(!isGlobal);
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
                      const color = stockColor(pct, !isGlobal);
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
              /* ── 카드뷰 v3 ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-sm)' }}>
                {displayStocks.map((s) => {
                  const pct = s.change_pct ?? 0;
                  const isGlobal = s.currency === 'USD';
                  const isWatched = watchlistSymbols.includes(s.symbol);
                  const upColor = stockUpColor(!isGlobal);
                  const downColor = stockDownColor(!isGlobal);
                  const priceColor = pct > 0 ? upColor : pct < 0 ? downColor : 'var(--text-tertiary)';
                  const pts = sparklines[s.symbol];
                  const w52h = pts?.length >= 2 ? Math.max(...pts) : null;
                  const w52l = pts?.length >= 2 ? Math.min(...pts) : null;
                  const w52pos = w52h && w52l && w52h !== w52l ? Math.round(((Number(s.price) - w52l) / (w52h - w52l)) * 100) : null;
                  const sparkEl = pts?.length >= 2 ? (() => {
                    const min = Math.min(...pts); const max = Math.max(...pts); const range = max - min || 1;
                    const W = 80; const H = 26;
                    const coords = pts.map((v: number, i: number) => [(i / (pts.length - 1)) * W, H - 2 - ((v - min) / range) * (H - 4)]);
                    const line = coords.map(([x,y]: number[]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
                    const fillPath = `M${coords[0][0].toFixed(1)},${H} ` + coords.map(([x,y]: number[]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${coords[coords.length-1][0].toFixed(1)},${H}Z`;
                    const fillCol = pct > 0 ? (isGlobal ? 'rgba(46,232,165,0.12)' : 'rgba(255,107,107,0.12)') : pct < 0 ? (isGlobal ? 'rgba(248,113,113,0.12)' : 'rgba(108,180,255,0.12)') : 'rgba(148,163,184,0.08)';
                    const last = coords[coords.length - 1];
                    return (
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                        <path d={fillPath} fill={fillCol} />
                        <polyline points={line} fill="none" stroke={priceColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx={last[0]} cy={last[1]} r="2" fill="var(--bg-base)" stroke={priceColor} strokeWidth="1.5" />
                      </svg>
                    );
                  })() : null;
                  return (
                    <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} className="kd-section-card" style={{
                      display: 'block', padding: 0, background: 'var(--bg-surface)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
                      textDecoration: 'none', color: 'inherit', position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ height: 3, background: `linear-gradient(90deg, ${priceColor}, ${priceColor}40, transparent)` }} />
                      <div style={{ padding: '10px 12px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0 }}>
                            {(() => { const logo = getStockLogo(s.symbol, !isGlobal); return s.logo_url ? (
                              <img src={s.logo_url} alt={`${s.name} 로고`} width={32} height={32} style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', objectFit: 'contain', flexShrink: 0, background: '#fff', padding: 2 }} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.removeProperty('display'); }} />
                            ) : (
                              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: logo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: logo.initials.length > 2 ? 8 : 11, fontWeight: 800, color: logo.textColor, letterSpacing: '-0.02em' }}>{logo.initials}</div>
                            ); })()}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>{s.name}</div>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{s.symbol}</span>
                                {s.sector && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: `${priceColor}12`, color: priceColor, fontWeight: 600 }}>{s.sector}</span>}
                              </div>
                            </div>
                          </div>
                          <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(s.symbol); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 14, color: isWatched ? 'var(--accent-yellow)' : 'var(--text-tertiary)', flexShrink: 0, opacity: isWatched ? 1 : 0.4 }}>
                            {isWatched ? '★' : '☆'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
                          <div>
                            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                              {s.price === 0 ? '—' : isGlobal ? `$${Number(s.price)?.toLocaleString('en', {minimumFractionDigits:2, maximumFractionDigits:2})}` : `₩${fmt(Number(s.price))}`}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: priceColor, display: 'inline-block', padding: '1px 6px', borderRadius: 5, background: `${priceColor}12`, marginTop: 2 }}>
                              {pct > 0 ? `▲ ${pct.toFixed(2)}%` : pct < 0 ? `▼ ${Math.abs(pct).toFixed(2)}%` : '전일종가'}
                            </div>
                          </div>
                          {sparkEl}
                        </div>
                        {w52pos !== null && (
                          <div style={{ marginBottom: 4 }}>
                            <div style={{ height: 3, borderRadius: 4, background: 'var(--bg-hover)', position: 'relative' }}>
                              <div style={{ height: '100%', width: `${w52pos}%`, borderRadius: 4, background: `linear-gradient(90deg, ${stockDownColor(isDomestic)}, ${priceColor})` }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                              <span>52주</span><span>{w52pos}%</span>
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {s.market_cap > 0 && <span>시총 {fmtCap(Number(s.market_cap), s.currency)}</span>}
                          {s.volume > 0 && <span>{Number(s.volume) >= 1000000 ? (Number(s.volume) / 1000000).toFixed(1) + 'M' : Number(s.volume) >= 1000 ? Math.round(Number(s.volume) / 1000) + 'K' : Number(s.volume).toLocaleString()}</span>}
                        </div>
                      </div>
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
            const upC = stockUpColor(isDomestic);
            const downC = stockDownColor(isDomestic);
            return (
              <div style={{ padding: '12px 0 14px', borderTop: '1px solid var(--border)', marginTop: 'var(--sp-xs)' }}>
                {/* 오늘 성과 요약 */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>평균 등락</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: avgPct >= 0 ? upC : downC, fontVariantNumeric: 'tabular-nums' }}>{avgPct >= 0 ? '+' : ''}{avgPct.toFixed(2)}%</div>
                  </div>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>상승</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: upC }}>{up}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 2 }}>종목</span></div>
                  </div>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>하락</div>
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
          {currentTab === 'ranking' && filteredStocks.length > stockListLimit && !tossActive && (
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
          {tossActive && filteredStocks.length > 10 && (
            <TossTeaser
              path="/stock"
              label={`전체 ${filteredStocks.length.toLocaleString()}종목 보기`}
              subtitle="실시간 시세 · 히트맵 · 포트폴리오 시뮬레이터"
            />
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
                        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 4, marginTop: 'var(--sp-xs)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${((c.sa.market_cap||0)/maxCap)*100}%`, background: colorA, borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtCap(c.sa.market_cap, c.sa.currency)}</div>
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
                        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 4, marginTop: 'var(--sp-xs)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${((c.sb.market_cap||0)/maxCap)*100}%`, background: colorB, borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtCap(c.sb.market_cap, c.sb.currency)}</div>
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
      {/* 실시간 트렌드 */}
      <TrendingKeywords />

      {/* 환율 추이 미니 차트 */}
      <div style={{ margin: '12px 0' }}><ExchangeRateMiniChart /></div>

      {/* 관련 서비스 (내부 링크 — SEO 교차 참조) */}
      <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginBottom: 12 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>🔗 함께 보면 좋은 서비스</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { href: '/apt', label: '🏠 부동산 청약', desc: '전국 청약·분양·미분양' },
            { href: '/stock/compare', label: '⚖️ 종목 비교', desc: '핵심 지표 나란히 비교' },
            { href: '/stock/data', label: '📊 주식 통계', desc: '종목별 데이터 다운로드' },
            { href: '/blog', label: '📝 투자 블로그', desc: '주식·부동산 데이터 분석' },
            { href: '/daily/서울', label: '📰 데일리 리포트', desc: '오늘의 시장 브리핑' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ padding: '6px 12px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 500, background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none', border: '1px solid var(--border)' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

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
