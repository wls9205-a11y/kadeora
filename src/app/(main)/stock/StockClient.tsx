'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const PortfolioTab = dynamic(() => import('@/components/PortfolioTab'), { ssr: false });
const SectorHeatmap = dynamic(() => import('@/components/SectorHeatmap'), { ssr: false });
const StockDetailSheet = dynamic(() => import('./StockDetailSheet'), { ssr: false });
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
interface Props { initialStocks: Stock[]; briefing?: Record<string, any>; exchangeHistory?: Record<string, any>[]; themeHistory?: Record<string, any>[]; }

function isIdx(s: Stock) { return ['KOSPI','KOSDAQ','NASDAQ','S&P 500','DOW','NIKKEI'].some(idx => s.name.toUpperCase().includes(idx) || s.symbol.toUpperCase().includes(idx)); }

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
export default function StockClient({ initialStocks, briefing, exchangeHistory, themeHistory }: Props) {
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
      ...stocks.filter(s => s.price > 0).slice(0, 60).map(s => s.symbol),
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
    return (
      <Link href={`/stock/${encodeURIComponent(s.symbol)}`} onClick={e => e.stopPropagation()} className="kd-feed-card" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 4px 11px 0',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', transition: 'background 0.12s',
        textDecoration: 'none', color: 'inherit',
      }}>
        {/* 좌측 컬러 바 */}
        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: barColor, flexShrink: 0, minHeight: 36 }} />
        {/* 순위 */}
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 16, textAlign: 'center' }}>{rank}</span>
        {/* 관심 */}
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(s.symbol); }} className={isWatched ? 'animate-like' : ''} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 15, lineHeight: 1, color: isWatched ? 'var(--accent-yellow)' : 'var(--text-tertiary)', flexShrink: 0 }}>
          {isWatched ? '★' : '☆'}
        </button>
        {/* 종목명 + 메타 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            {Math.abs(pct) >= 10 && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: pct > 0 ? (isGlobal ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)') : (isGlobal ? 'rgba(248,113,113,0.15)' : 'rgba(96,165,250,0.15)'), color: pct > 0 ? upColor : downColor, fontWeight: 800, flexShrink: 0 }}>
                {pct > 0 ? '급등' : '급락'}
              </span>
            )}
            {(isNearHigh || isNearLow) && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: isNearHigh ? 'rgba(248,113,113,0.1)' : 'rgba(96,165,250,0.1)', color: isNearHigh ? 'var(--accent-red)' : 'var(--accent-blue)', fontWeight: 700, flexShrink: 0 }}>
                {isNearHigh ? '신고가' : '신저가'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{s.symbol}</span>
            {s.sector && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '0 5px', borderRadius: 3 }}>{s.sector}</span>}
            {s.market_cap > 0 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtCap(s.market_cap, s.currency)}</span>}
          </div>
        </div>
        {/* 스파크라인 */}
        {pts?.length >= 2 && (
          <span className="stock-sparkline" style={{ flexShrink: 0 }}>
            <MiniSparkline data={pts} width={48} height={22} />
          </span>
        )}
        {/* 가격 + 등락 */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 88 }}>
          {s.price === 0 ? (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>미제공</span>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>
                {isGlobal ? `$${s.price?.toFixed(2)}` : `₩${fmt(s.price)}`}
              </div>
              {isGlobal && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 1 }}>≈₩{Math.round(s.price * exchangeRate).toLocaleString()}</div>}
              {isStale ? (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>장 마감</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: stockColor(pct, !isGlobal) }}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Link>
    );
  }, [watchlistSymbols, toggleWatchlist, sparklines, exchangeRate]);

  const domesticTabs = [['ranking','📊 시총'],['movers','📈 등락률'],['sector','🗺️ 섹터'],['themes','🔥 테마'],['news','📰 뉴스'],['calendar','📅 캘린더'],['watchlist','⭐ 관심'],['portfolio','💰 포트폴리오']] as const;
  const globalTabs = [['ranking','📊 시총'],['movers','📈 등락률'],['sector','🗺️ 섹터'],['news','📰 뉴스'],['m7','🏆 M7'],['watchlist','⭐ 관심'],['portfolio','💰 포트폴리오']] as const;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>📊 주식</h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {(() => {
              const ms = getMarketStatus();
              const lastUpdate = stocks.length > 0 ? stocks.reduce((latest, s) => s.updated_at > latest ? s.updated_at : latest, stocks[0].updated_at) : null;
              return (
                <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 700, color: ms.color, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: `1.5px solid ${ms.color}40` }}>
                  {ms.label}
                  {lastUpdate && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>{new Date(lastUpdate).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
                </span>
              );
            })()}
            <Link href="/stock/compare" className="kd-action-link">⚔️ 비교</Link>
          </div>
        </div>
        {/* 환율 + 상승/하락 통합 배너 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          {/* 환율 카드 */}
          <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>원/달러 환율</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>원</span>
              {exchangeHistory && exchangeHistory.length > 1 && (() => {
                const rates = exchangeHistory.map((h: Record<string, any>) => h.rate);
                const changePct = rates.length >= 2 ? ((rates[rates.length-1] - rates[rates.length-2]) / rates[rates.length-2] * 100) : 0;
                if (Math.abs(changePct) < 0.01) return null;
                return <span style={{ fontSize: 11, fontWeight: 700, color: changePct > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{changePct > 0 ? '▲' : '▼'}{Math.abs(changePct).toFixed(2)}%</span>;
              })()}
            </div>
            {exchangeHistory && exchangeHistory.length > 1 && (() => {
              const rates = exchangeHistory.map((h: Record<string, any>) => h.rate);
              const min = Math.min(...rates); const max = Math.max(...rates);
              const range = max - min || 1;
              const W = 100; const H = 24;
              const points = rates.map((r: number, i: number) => `${(i / (rates.length - 1)) * W},${H - 2 - ((r - min) / range) * (H - 4)}`).join(' ');
              const isUp = rates[rates.length - 1] > rates[0];
              return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 24, marginTop: 2 }}><polyline points={points} fill="none" stroke={isUp ? 'var(--accent-red)' : 'var(--accent-green)'} strokeWidth="1.5" strokeLinecap="round" /></svg>;
            })()}
          </div>
          {/* 시장 심리 카드 */}
          {sentimentStocks.length > 0 && (
            <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{isDomestic ? 'KOSPI·KOSDAQ' : 'NYSE·NASDAQ'} 심리</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => { isDomestic ? setDomesticTab('movers') : setGlobalTab('movers'); setMoversTab('up'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: isDomestic ? 'var(--accent-red)' : 'var(--accent-green)', fontVariantNumeric: 'tabular-nums' }}>{upCount}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>상승</span>
                </button>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(upCount/sentTotal)*100}%`, background: isDomestic ? 'var(--accent-red)' : 'var(--accent-green)', transition: 'width 0.5s' }} />
                    <div style={{ width: `${(flatCount/sentTotal)*100}%`, background: 'var(--bg-hover)' }} />
                    <div style={{ width: `${(downCount/sentTotal)*100}%`, background: isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center' }}>보합 {flatCount}</div>
                </div>
                <button onClick={() => { isDomestic ? setDomesticTab('movers') : setGlobalTab('movers'); setMoversTab('down'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)', fontVariantNumeric: 'tabular-nums' }}>{downCount}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>하락</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI 일일 시황 */}
      {briefing && (
        <div style={{
          background: briefing.sentiment === 'bullish'
            ? 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.02))'
            : briefing.sentiment === 'bearish'
            ? 'linear-gradient(135deg, rgba(248,113,113,0.08), rgba(248,113,113,0.02))'
            : 'var(--bg-surface)',
          border: `1px solid ${briefing.sentiment === 'bullish' ? 'rgba(52,211,153,0.2)' : briefing.sentiment === 'bearish' ? 'rgba(248,113,113,0.2)' : 'var(--border)'}`,
          borderRadius: 10, padding: '12px 14px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: briefingOpen ? 6 : 0, cursor: 'pointer' }} onClick={() => setBriefingOpen(v => !v)}>
            <span style={{ fontSize: 22 }}>{briefing.sentiment === 'bullish' ? '🐂' : briefing.sentiment === 'bearish' ? '🐻' : '😐'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>{briefing.title}</div>
            </div>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, fontWeight: 700,
              background: briefing.sentiment === 'bullish' ? 'rgba(52,211,153,0.15)' : briefing.sentiment === 'bearish' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)',
              color: briefing.sentiment === 'bullish' ? 'var(--accent-green)' : briefing.sentiment === 'bearish' ? 'var(--accent-red)' : 'var(--text-secondary)',
            }}>{briefing.sentiment === 'bullish' ? '강세' : briefing.sentiment === 'bearish' ? '약세' : '보합'}</span>
            <span style={{ fontSize: 16, color: 'var(--text-tertiary)', marginLeft: 4 }}>{briefingOpen ? '▲' : '▼'}</span>
          </div>
          {briefingOpen && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{briefing.summary}</div>}
          {/* Top movers */}
          {briefingOpen && (briefing.key_movers || briefing.top_movers) && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {((briefing.key_movers || briefing.top_movers)?.gainers || []).slice(0, 2).map((s: Record<string, any>) => (
                <span key={s.symbol} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', color: 'var(--accent-green)', fontWeight: 600 }}>
                  ▲ {s.name} +{s.change_pct?.toFixed(1)}%
                </span>
              ))}
              {((briefing.key_movers || briefing.top_movers)?.losers || []).slice(0, 2).map((s: Record<string, any>) => (
                <span key={s.symbol} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', fontWeight: 600 }}>
                  ▼ {s.name} {s.change_pct?.toFixed(1)}%
                </span>
              ))}
            </div>
          )}
          {/* Sector bars */}
          {briefingOpen && briefing.sector_analysis?.length > 0 && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {briefing.sector_analysis.slice(0, 6).map((sec: Record<string, any>) => {
                const pct = sec.avg_pct || 0;
                return (
                  <div key={sec.name} style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: pct > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(96,165,250,0.08)',
                    color: pct > 0 ? 'var(--accent-red)' : 'var(--accent-blue)',
                    fontWeight: 600,
                  }}>
                    {sec.name} {pct > 0 ? '+' : ''}{pct}%
                  </div>
                );
              })}
            </div>
          )}
          {briefingOpen && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>{briefing.briefing_date} 기준 · AI 분석</div>}
        </div>
      )}



      {/* 국내/해외 토글 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button onClick={() => { setMode('domestic'); setSearch(''); setSectorFilter('all'); setStockListLimit(30); }} aria-pressed={isDomestic} style={{
          flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
          background: isDomestic ? 'var(--brand)' : 'var(--bg-surface)',
          color: isDomestic ? '#fff' : 'var(--text-tertiary)',
          border: isDomestic ? 'none' : '1px solid var(--border)', cursor: 'pointer',
          boxShadow: isDomestic ? '0 2px 12px rgba(37,99,235,0.25)' : 'none',
          transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 18 }}>🇰🇷</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>국내주식</div>
            <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 400 }}>KOSPI · KOSDAQ {domesticStocks.filter(s=>s.price>0).length}종목</div>
          </div>
        </button>
        <button onClick={() => { setMode('global'); setSearch(''); setSectorFilter('all'); setStockListLimit(30); }} aria-pressed={!isDomestic} style={{
          flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
          background: !isDomestic ? '#2563EB' : 'var(--bg-surface)',
          color: !isDomestic ? '#fff' : 'var(--text-tertiary)',
          border: !isDomestic ? 'none' : '1px solid var(--border)', cursor: 'pointer',
          boxShadow: !isDomestic ? '0 2px 12px rgba(37,99,235,0.25)' : 'none',
          transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 18 }}>🇺🇸</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>해외주식</div>
            <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 400 }}>NYSE · NASDAQ {globalStocks.filter(s=>s.price>0).length}종목</div>
          </div>
        </button>
      </div>



      {/* 지수 카드 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {indexStocks.filter(s => isDomestic ? (s.market === 'KOSPI' || s.market === 'KOSDAQ') : (s.market === 'NYSE' || s.market === 'NASDAQ')).slice(0, 3).map(s => {
          const pct = s.change_pct ?? 0;
          const isUp = pct > 0;
          const isDown = pct < 0;
          const accentColor = isUp ? (isDomestic ? 'var(--accent-red)' : 'var(--accent-green)') : isDown ? (isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)') : 'var(--text-tertiary)';
          return (
            <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{ textDecoration: 'none', flexShrink: 0, flex: 1, minWidth: 100 }}>
              <div style={{
                padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                background: 'var(--bg-surface)',
                border: `1.5px solid ${pct !== 0 ? accentColor + '30' : 'var(--border)'}`,
                borderLeft: `3px solid ${accentColor}`,
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>{s.name}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {s.currency === 'USD' ? `$${s.price?.toLocaleString('en', {maximumFractionDigits:0})}` : fmt(s.price)}
                </div>
                {pct !== 0 ? (
                  <div style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
                    {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                  </div>
                ) : <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>장 마감</div>}
                {sparklines[s.symbol]?.length >= 2 && (
                  <div style={{ marginTop: 6 }}>
                    <MiniSparkline data={sparklines[s.symbol]} width={80} height={22} />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 급등/급락 배너 */}
      {(() => {
        const bigMovers = sentimentStocks.filter(s => Math.abs(s.change_pct ?? 0) >= 5).sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0)).slice(0, 5);
        if (bigMovers.length === 0) return null;
        return (
          <div style={{ marginBottom: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{ padding: '8px 10px', background: 'var(--bg-hover)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>⚡ 이슈</span>
              </div>
              <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {bigMovers.map((s, idx) => {
                  const pct = s.change_pct ?? 0;
                  const isUp = pct > 0;
                  const upColor = isDomestic ? 'var(--accent-red)' : 'var(--accent-green)';
                  const downColor = isDomestic ? 'var(--accent-blue)' : 'var(--accent-red)';
                  return (
                    <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{
                      flexShrink: 0, padding: '8px 14px', textDecoration: 'none',
                      borderRight: idx < bigMovers.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s',
                    }} className="kd-card-hover">
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isUp ? upColor : downColor }}>
                          {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 서브 탭 */}
      <div className="apt-pill-scroll" style={{ display: 'flex', gap: 0, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '3px' }}>
        {(isDomestic ? domesticTabs : globalTabs).map(([k, l]) => (
          <button key={k} onClick={() => { isDomestic ? setDomesticTab(k as typeof domesticTab) : setGlobalTab(k as typeof globalTab); }} aria-pressed={currentTab === k} style={{
            padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
            background: currentTab === k ? 'var(--brand)' : 'transparent',
            color: currentTab === k ? '#fff' : 'var(--text-tertiary)',
            boxShadow: currentTab === k ? '0 1px 6px rgba(37,99,235,0.3)' : 'none',
            transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* 섹터 탭 — 히트맵 */}
      {currentTab === 'sector' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <SectionShareButton section={isDomestic ? 'stock-kr' : 'stock-us'} label="주식 종목 한눈에 보기!" pagePath="/stock" />
          </div>
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
        <div style={{ marginBottom: 16 }}>
          {news.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📰</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>뉴스를 수집 중입니다</div>
              <div style={{ fontSize: 13 }}>잠시 후 다시 확인해주세요</div>
            </div>
          ) : news.map((item: Record<string, any>) => {
            const sent = item.sentiment_label;
            const sentColor = sent === 'positive' ? 'var(--accent-green)' : sent === 'negative' ? 'var(--accent-red)' : 'var(--text-tertiary)';
            const sentLabel = sent === 'positive' ? '긍정' : sent === 'negative' ? '부정' : '중립';
            const stock = stocks.find(s => s.symbol === item.symbol);
            return (
              <a key={item.id} href={item.url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', marginBottom: 8 }}>
                <div className="kd-card" style={{ padding: '12px 14px', transition: 'border-color 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{item.title}</div>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: sent === 'positive' ? 'rgba(52,211,153,0.1)' : sent === 'negative' ? 'rgba(248,113,113,0.1)' : 'var(--bg-hover)', color: sentColor, fontWeight: 700, flexShrink: 0 }}>{sentLabel}</span>
                  </div>
                  {item.ai_summary && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>{item.ai_summary}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {stock && (
                      <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{stock.name}</span>
                    )}
                    <span>{item.source}</span>
                    <span style={{ marginLeft: 'auto' }}>{item.published_at ? new Date(item.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

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
        <div style={{ marginBottom: 16 }}>
          {/* 테마 필터 칩 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button onClick={() => setSelectedTheme(null)} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: !selectedTheme ? 'var(--brand)' : 'var(--bg-hover)', color: !selectedTheme ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>전체</button>
            {themes.map(t => (
              <button key={t.id} onClick={() => setSelectedTheme(selectedTheme === t.theme_name ? null : t.theme_name)} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: selectedTheme === t.theme_name ? 'var(--brand)' : 'var(--bg-hover)', color: selectedTheme === t.theme_name ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>{t.is_hot ? '🔥' : ''}{t.theme_name}</button>
            ))}
          </div>
          {themes.filter(t => !selectedTheme || t.theme_name === selectedTheme).map(t => {
            const th = themeHistory?.find((h: Record<string, any>) => h.theme_name === t.theme_name);
            return (
            <div key={t.id} style={{ padding: 14, background: 'var(--bg-surface)', border: selectedTheme === t.theme_name ? '2px solid var(--brand)' : '1px solid var(--border)', borderRadius: 12, marginBottom: 8, overflow: 'hidden', position: 'relative' }}>
              {/* 등락 배경 */}
              <div style={{ position: 'absolute', inset: 0, background: (t.change_pct??0) > 0 ? 'linear-gradient(135deg, rgba(248,113,113,0.04), transparent)' : (t.change_pct??0) < 0 ? 'linear-gradient(135deg, rgba(96,165,250,0.04), transparent)' : 'transparent', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, position: 'relative' }}>
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
                  <div style={{ fontSize: 20, fontWeight: 800, color: stockColor(t.change_pct??0, true), fontVariantNumeric: 'tabular-nums' }}>{(t.change_pct??0)>0?'+':''}{(t.change_pct??0).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t.related_symbols?.length ?? 0}종목</div>
                </div>
              </div>
              {t.description && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>{t.description}</div>}
              {/* Related stocks mini list */}
              {t.related_symbols?.slice(0, 3).map(sym => {
                const rs = stocks.find(s => s.symbol === sym);
                if (!rs) return null;
                return (
                  <Link key={sym} href={`/stock/${sym}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', fontSize: 11, textDecoration: 'none', color: 'var(--text-secondary)', marginRight: 4 }}>
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
      {!isDomestic && globalTab === 'm7' && (() => {
        const m7Stocks = M7.map(sym => stocks.find(s => s.symbol === sym)).filter(Boolean) as Stock[];
        const totalCap = m7Stocks.reduce((s, st) => s + (st.market_cap || 0), 0);
        const maxCap = Math.max(...m7Stocks.map(st => st.market_cap || 0));
        const upCount7 = m7Stocks.filter(st => (st.change_pct ?? 0) > 0).length;
        const downCount7 = m7Stocks.filter(st => (st.change_pct ?? 0) < 0).length;
        return (
        <div style={{ marginBottom: 14 }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>🏆 Magnificent 7</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>합산 시총 {fmtCap(totalCap, 'USD')} · <span style={{ color: 'var(--accent-green)' }}>▲{upCount7}</span> <span style={{ color: 'var(--accent-red)' }}>▼{downCount7}</span></div>
            </div>
          </div>
          {/* 카드 그리드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {m7Stocks.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).map((st) => {
              const pct = st.change_pct ?? 0;
              const color = pct > 0 ? 'var(--accent-green)' : pct < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)';
              const capPct = maxCap > 0 ? ((st.market_cap || 0) / maxCap) * 100 : 0;
              const pts = sparklines[st.symbol];
              return (
                <Link key={st.symbol} href={`/stock/${encodeURIComponent(st.symbol)}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 10, border: `1px solid ${pct > 0 ? 'rgba(52,211,153,0.2)' : pct < 0 ? 'rgba(248,113,113,0.2)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s', position: 'relative', overflow: 'hidden' }}>
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
          <div style={{ display: 'flex', gap: 0, marginBottom: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
            {([['up','📈 상승'],['down','📉 하락'],['volume','🔥 거래량']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setMoversTab(k)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: moversTab===k?'var(--brand)':'transparent', color: moversTab===k?'#fff':'var(--text-tertiary)' }}>{l}</button>
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
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: isDomestic ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)', border: `1px solid ${isDomestic ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}` }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{isDomestic ? '+5% 이상 상승' : '+5% Gainers'}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: upColor }}>{up5}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 3 }}>종목</span></div>
                    {limitUp > 0 && <div style={{ fontSize: 10, marginTop: 2, color: upColor, fontWeight: 700 }}>🔺 상한가 {limitUp}종목</div>}
                  </div>
                )}
                {down5 > 0 && (
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: isDomestic ? 'rgba(96,165,250,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${isDomestic ? 'rgba(96,165,250,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{isDomestic ? '-5% 이상 하락' : '-5% Losers'}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: downColor }}>{down5}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 3 }}>종목</span></div>
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
              padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)',
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
                padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0, maxWidth: 110,
              }}>
                {sectorList.map(s => <option key={s} value={s}>{s === 'all' ? '전체 섹터' : s}</option>)}
              </select>
            );
          })()}
          {/* 시세 미제공 */}
          {inactiveCount > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ accentColor: 'var(--brand)', width: 13, height: 13 }} />
              미제공 {inactiveCount}
            </label>
          )}
        </div>
      )}

      {/* 포트폴리오 탭 */}
      {currentTab === 'portfolio' && <PortfolioTab />}

      {/* 시총 탭 — TOP3 하이라이트 카드 */}
      {currentTab === 'ranking' && filteredStocks.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
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
                  padding: '10px 10px 8px', borderRadius: 10,
                  background: 'var(--bg-surface)', border: `1.5px solid ${pct > 0 ? (isGlobal ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)') : pct < 0 ? (isGlobal ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.25)') : 'var(--border)'}`,
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
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
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 12px', overflow: 'hidden' }}>
          {displayStocks.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              {currentTab === 'watchlist' ? (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>⭐</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>관심종목을 추가해보세요</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>종목 목록에서 ☆ 버튼을 눌러 추가</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>
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
                            <div style={{ fontSize: 11, fontWeight: 700, color }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>
                          </div>
                          <button onClick={() => toggleWatchlist(s.symbol)} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
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
                  {search && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 8 }}>종목명, 종목코드, 섹터로 검색해보세요</div>}
                </div>
              )}
            </div>
          ) : displayStocks.map((s, i) => <StockRow key={s.symbol} s={s} rank={i + 1} />)}
          {/* 관심종목 탭: 알림 설정 링크 */}
          {currentTab === 'watchlist' && displayStocks.length > 0 && (
            <div style={{ padding: '10px 0 14px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Link href="/stock/compare" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '5px 10px', borderRadius: 6, background: 'var(--brand-bg)', border: '1px solid var(--brand-border)' }}>
                  ⚔️ 관심종목 비교
                </Link>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '5px 10px', borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                  총 {displayStocks.length}종목 관심
                </span>
              </div>
            </div>
          )}
          {/* 더보기 버튼 (시총 탭) */}
          {currentTab === 'ranking' && filteredStocks.length > stockListLimit && (
            <button onClick={() => setStockListLimit(prev => prev + 30)} style={{
              display: 'block', width: '100%', padding: '13px 0', margin: '8px 0 12px',
              background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10,
              color: 'var(--brand)', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.2px',
            }}>
              더보기 {filteredStocks.length - stockListLimit}종목 더 ›
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>⚔️ 맞대결</div>
              <Link href="/stock/compare" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>더보기 →</Link>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              {valid.map(c => {
                const pctA = c.sa.change_pct ?? 0;
                const pctB = c.sb.change_pct ?? 0;
                const winner = Math.abs(pctA) > Math.abs(pctB) ? 'A' : Math.abs(pctB) > Math.abs(pctA) ? 'B' : null;
                const colorA = stockColor(pctA, isKR);
                const colorB = stockColor(pctB, isKR);
                const maxCap = Math.max(c.sa.market_cap || 0, c.sb.market_cap || 0) || 1;
                return (
                  <div key={c.t} style={{ minWidth: 240, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10 }}>{c.t}</div>
                    {/* 종목 A */}
                    <Link href={`/stock/${encodeURIComponent(c.sa.symbol)}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, textDecoration: 'none', padding: '6px 8px', borderRadius: 8, background: winner === 'A' ? (pctA > 0 ? (isKR ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)') : (isKR ? 'rgba(96,165,250,0.06)' : 'rgba(248,113,113,0.06)')) : 'transparent' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.sa.name} {winner==='A'&&'👑'}</div>
                        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2, marginTop: 4, overflow:'hidden' }}>
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
                    <Link href={`/stock/${encodeURIComponent(c.sb.symbol)}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '6px 8px', borderRadius: 8, background: winner === 'B' ? (pctB > 0 ? (isKR ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)') : (isKR ? 'rgba(96,165,250,0.06)' : 'rgba(248,113,113,0.06)')) : 'transparent' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.sb.name} {winner==='B'&&'👑'}</div>
                        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2, marginTop: 4, overflow:'hidden' }}>
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
