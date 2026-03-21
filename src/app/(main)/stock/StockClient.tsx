'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Stock {
  symbol: string; name: string; market: string; price: number; change_amt: number;
  change_pct: number; volume: number; market_cap: number; updated_at: string;
  currency?: string; sector?: string; description?: string;
}
interface Theme { id: number; theme_name: string; change_pct: number; is_hot: boolean; related_symbols?: string[]; description?: string; }
interface CalendarEvent { id: number; event_date: string; title: string; category: string; importance: string; description?: string; }
interface Props { initialStocks: Stock[]; briefing?: any; exchangeHistory?: any[]; themeHistory?: any[]; }

function fmt(n: number) { return n ? n.toLocaleString('ko-KR') : '0'; }
function fmtCap(n: number, cur?: string) {
  if (!n) return '-';
  if (cur === 'USD') { if (n >= 1e12) return `$${(n/1e12).toFixed(1)}T`; if (n >= 1e9) return `$${(n/1e9).toFixed(0)}B`; return `$${(n/1e6).toFixed(0)}M`; }
  if (n >= 1e12) return `${(n/1e12).toFixed(1)}조`; if (n >= 1e8) return `${Math.round(n/1e8)}억`; return fmt(n);
}
function isIdx(s: Stock) { return ['KOSPI','KOSDAQ','NASDAQ','S&P 500','DOW','NIKKEI'].some(idx => s.name.toUpperCase().includes(idx) || s.symbol.toUpperCase().includes(idx)); }

const M7 = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];
const SECTORS = ['all','반도체','바이오','금융','자동차','방산','IT/소프트웨어','에너지','2차전지','소비재','건설','통신','유틸리티','화학','미디어'];

export default function StockClient({ initialStocks, briefing, exchangeHistory, themeHistory }: Props) {
  const [stocks, setStocks] = useState<Stock[]>(Array.isArray(initialStocks) ? initialStocks : []);
  const [mode, setMode] = useState<'domestic'|'global'>('domestic');
  const [domesticTab, setDomesticTab] = useState<'ranking'|'movers'|'themes'|'calendar'|'watchlist'>('ranking');
  const [globalTab, setGlobalTab] = useState<'ranking'|'movers'|'m7'|'watchlist'>('ranking');
  const [domesticMarket, setDomesticMarket] = useState<'ALL'|'KOSPI'|'KOSDAQ'>('ALL');
  const [moversTab, setMoversTab] = useState<'up'|'down'|'volume'>('up');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [exchangeRate, setExchangeRate] = useState(1500);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  useEffect(() => {
    fetch('/api/stock/themes').then(r => r.ok ? r.json() : null).then(d => { if (d?.themes) setThemes(d.themes); }).catch(() => {});
    fetch('/api/stock/calendar').then(r => r.ok ? r.json() : null).then(d => { if (d?.events) setCalendarEvents(d.events); }).catch(() => {});
    fetch('/api/stock/watchlist').then(r => r.ok ? r.json() : null).then(d => { if (d?.symbols) setWatchlistSymbols(d.symbols); }).catch(() => {});
    fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).then(d => { if (d?.rates?.KRW) setExchangeRate(d.rates.KRW); }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const sb = (await import('@/lib/supabase-browser')).createSupabaseBrowser();
      const { data } = await sb.from('stock_quotes').select('*').order('market_cap', { ascending: false });
      if (data?.length) setStocks(data as any);
    } catch {}
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 5 * 60 * 1000); return () => clearInterval(id); }, [refresh]);

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
    }).slice(0, 30);
  }

  const filteredStocks = getFilteredStocks();
  const currentTab = isDomestic ? domesticTab : globalTab;

  function StockRow({ s, rank }: { s: Stock; rank: number }) {
    const pct = s.change_pct ?? 0;
    const isGlobal = s.currency === 'USD';
    return (
      <div onClick={() => setSelectedStock(s)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 24, textAlign: 'center' }}>{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.symbol}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {s.sector && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{s.sector}</span>}
            {s.market_cap > 0 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtCap(s.market_cap, s.currency)}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {s.price === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>시세 미제공</span>
          ) : (
            <>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isGlobal ? `$${s.price?.toFixed(2)}` : `₩${fmt(s.price)}`}
              </div>
              {isGlobal && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>≈₩{Math.round(s.price * exchangeRate).toLocaleString()}</div>}
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: pct > 0 ? '#22c55e' : pct < 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                {pct > 0 ? '▲' : pct < 0 ? '▼' : '—'} {Math.abs(pct).toFixed(2)}%
              </div>
            </>
          )}
        </div>
        <Link href={`/stock/${encodeURIComponent(s.symbol)}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', textDecoration: 'none', flexShrink: 0 }}>상세</Link>
      </div>
    );
  }

  const domesticTabs = [['ranking','📊 시총'],['movers','📈 등락률'],['themes','🔥 테마'],['calendar','📅 캘린더'],['watchlist','⭐ 관심']] as const;
  const globalTabs = [['ranking','📊 시총'],['movers','📈 등락률'],['m7','🏆 M7'],['watchlist','⭐ 관심']] as const;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>📊 주식</h1>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>원/달러</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₩{exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
          {exchangeHistory && exchangeHistory.length > 1 && (() => {
            const rates = exchangeHistory.map((h: any) => h.rate);
            const min = Math.min(...rates); const max = Math.max(...rates);
            const range = max - min || 1;
            const points = rates.map((r: number, i: number) => `${(i / (rates.length - 1)) * 32},${16 - ((r - min) / range) * 14}`).join(' ');
            const isUp = rates[rates.length - 1] > rates[0];
            return <svg viewBox="0 0 32 16" style={{ width: 32, height: 16, verticalAlign: 'middle' }}><polyline points={points} fill="none" stroke={isUp ? '#ef4444' : '#22c55e'} strokeWidth="1.5" /></svg>;
          })()}
        </div>
      </div>

      {/* AI 일일 시황 */}
      {briefing && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>{briefing.sentiment === 'bullish' ? '🐂' : briefing.sentiment === 'bearish' ? '🐻' : '😐'}</span>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{briefing.title}</div>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
              background: briefing.sentiment === 'bullish' ? 'rgba(34,197,94,0.15)' : briefing.sentiment === 'bearish' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
              color: briefing.sentiment === 'bullish' ? '#22c55e' : briefing.sentiment === 'bearish' ? '#ef4444' : '#94a3b8',
            }}>{briefing.sentiment === 'bullish' ? '강세' : briefing.sentiment === 'bearish' ? '약세' : '보합'}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>{briefing.summary}</div>
          {/* Top movers badges */}
          {briefing.top_movers && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(briefing.top_movers.gainers || []).slice(0, 2).map((s: any) => (
                <span key={s.symbol} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }}>
                  ▲ {s.name} +{s.change_pct?.toFixed(1)}%
                </span>
              ))}
              {(briefing.top_movers.losers || []).slice(0, 2).map((s: any) => (
                <span key={s.symbol} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>
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
                  fontSize: 10, padding: '3px 8px', borderRadius: 6,
                  background: (sec.avg_pct || 0) > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  color: (sec.avg_pct || 0) > 0 ? '#22c55e' : '#ef4444',
                  fontWeight: 600,
                }}>
                  {sec.name} {(sec.avg_pct || 0) > 0 ? '+' : ''}{sec.avg_pct}%
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
            {briefing.briefing_date} 기준 · AI 자동 생성
          </div>
        </div>
      )}

      {/* 국내/해외 메인 토글 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setMode('domestic')} style={{
          flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
          background: isDomestic ? 'var(--brand)' : 'var(--bg-surface)',
          color: isDomestic ? '#fff' : 'var(--text-secondary)',
          border: isDomestic ? 'none' : '1px solid var(--border)', cursor: 'pointer',
        }}>🇰🇷 국내주식</button>
        <button onClick={() => setMode('global')} style={{
          flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
          background: !isDomestic ? '#3b82f6' : 'var(--bg-surface)',
          color: !isDomestic ? '#fff' : 'var(--text-secondary)',
          border: !isDomestic ? 'none' : '1px solid var(--border)', cursor: 'pointer',
        }}>🇺🇸 해외주식</button>
      </div>

      {/* 지수 바 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {indexStocks.filter(s => isDomestic ? (s.market === 'KOSPI' || s.market === 'KOSDAQ') : (s.market === 'NYSE' || s.market === 'NASDAQ')).slice(0, 3).map(s => {
          const pct = s.change_pct ?? 0;
          return (
            <div key={s.symbol} style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, flexShrink: 0, minWidth: 140 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{s.currency === 'USD' ? `$${s.price?.toFixed(0)}` : fmt(s.price)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: pct > 0 ? '#22c55e' : pct < 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                  {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 상승/하락 비율 */}
      {sentimentStocks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>▲ {upCount}</span>
            <span>· — {flatCount}</span>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>· ▼ {downCount}</span>
          </div>
          <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${(upCount/sentTotal)*100}%`, background: '#22c55e' }} />
            <div style={{ width: `${(flatCount/sentTotal)*100}%`, background: 'var(--bg-hover)' }} />
            <div style={{ width: `${(downCount/sentTotal)*100}%`, background: '#ef4444' }} />
          </div>
        </div>
      )}

      {/* 테마 (국내만) */}
      {isDomestic && themes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>🔥 오늘의 테마</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {themes.map(t => (
              <div key={t.id} onClick={() => setDomesticTab('themes')} style={{ minWidth: 110, padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, flexShrink: 0, cursor: 'pointer' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t.is_hot && '🔥'}{t.theme_name}</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3, color: (t.change_pct??0)>0 ? '#22c55e' : (t.change_pct??0)<0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                  {(t.change_pct??0)>0?'+':''}{(t.change_pct??0).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 서브 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px' }}>
        {(isDomestic ? domesticTabs : globalTabs).map(([k, l]) => (
          <button key={k} onClick={() => isDomestic ? setDomesticTab(k as any) : setGlobalTab(k as any)} style={{
            padding: '7px 14px', borderRadius: 2, border: 'none', cursor: 'pointer', flexShrink: 0, fontWeight: 700, fontSize: 13,
            background: currentTab === k ? 'var(--border)' : 'transparent',
            color: currentTab === k ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>{l}</button>
        ))}
      </div>

      {/* 캘린더 탭 */}
      {isDomestic && domesticTab === 'calendar' && (
        <div style={{ marginBottom: 16 }}>
          {calendarEvents.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>예정된 이벤트가 없습니다</div> :
          calendarEvents.map(ev => (
            <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6, alignItems: 'center' }}>
              <div style={{ textAlign: 'center', flexShrink: 0, width: 44 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(ev.event_date).toLocaleDateString('ko-KR',{month:'short'})}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{new Date(ev.event_date).getDate()}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.importance==='high'?'🔴':ev.importance==='medium'?'🟡':'⚪'} {ev.title}</div>
                {ev.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{ev.description}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 테마 상세 탭 */}
      {isDomestic && domesticTab === 'themes' && (
        <div style={{ marginBottom: 16 }}>
          {themes.map(t => {
            const th = themeHistory?.find((h: any) => h.theme_name === t.theme_name);
            return (
            <div key={t.id} style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t.is_hot&&'🔥 '}{t.theme_name}</span>
                  {th?.prev_change_pct != null && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      전일 {(th.prev_change_pct > 0 ? '+' : '')}{Number(th.prev_change_pct).toFixed(1)}%
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: (t.change_pct??0)>0?'#22c55e':'#ef4444' }}>{(t.change_pct??0)>0?'+':''}{(t.change_pct??0).toFixed(1)}%</span>
              </div>
              {t.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{t.description}</div>}
              {t.related_symbols?.length && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {t.related_symbols.map(sym => {
                    const st = stocks.find(s => s.symbol === sym);
                    return st ? (
                      <Link key={sym} href={`/stock/${sym}`} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
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
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>🏆 Magnificent 7</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {M7.map(sym => {
              const st = stocks.find(s => s.symbol === sym);
              if (!st) return null;
              const pct = st.change_pct ?? 0;
              return (
                <Link key={sym} href={`/stock/${sym}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '12px', background: 'var(--bg-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{st.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>{sym}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>${st.price?.toFixed(2)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: pct>0?'#22c55e':pct<0?'#ef4444':'var(--text-tertiary)', marginTop: 2 }}>
                      {pct>0?'▲':pct<0?'▼':'—'} {Math.abs(pct).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtCap(st.market_cap, 'USD')}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 등락률 서브탭 */}
      {currentTab === 'movers' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {([['up','📈 상승'],['down','📉 하락'],['volume','🔥 거래량']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setMoversTab(k)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: moversTab===k?'var(--brand)':'var(--bg-hover)', color: moversTab===k?'#fff':'var(--text-secondary)' }}>{l}</button>
          ))}
        </div>
      )}

      {/* 섹터 필터 (시총/등락률) */}
      {(currentTab === 'ranking' || currentTab === 'movers') && isDomestic && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {SECTORS.map(s => (
            <button key={s} onClick={() => setSectorFilter(s)} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: sectorFilter===s?'var(--text-primary)':'var(--bg-hover)', color: sectorFilter===s?'var(--bg-base)':'var(--text-tertiary)' }}>{s==='all'?'전체':s}</button>
          ))}
        </div>
      )}

      {/* KOSPI/KOSDAQ 토글 (국내 시총 탭) */}
      {isDomestic && domesticTab === 'ranking' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {(['ALL','KOSPI','KOSDAQ'] as const).map(m => (
            <button key={m} onClick={() => setDomesticMarket(m)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: domesticMarket===m?(isDomestic?'var(--brand)':'#3b82f6'):'var(--bg-hover)', color: domesticMarket===m?'#fff':'var(--text-secondary)' }}>
              {m==='ALL'?'전체':m}
            </button>
          ))}
        </div>
      )}

      {/* 검색 */}
      {currentTab !== 'calendar' && currentTab !== 'themes' && currentTab !== 'm7' && (
        <div style={{ marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="종목명 또는 코드 검색"
            style={{ padding: '8px 14px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }} />
        </div>
      )}

      {/* 종목 리스트 */}
      {currentTab !== 'calendar' && currentTab !== 'themes' && currentTab !== 'm7' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px' }}>
          {filteredStocks.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              {currentTab === 'watchlist' ? '관심종목을 추가해보세요' : '검색 결과가 없어요'}
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
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🔀 종목 비교</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              {valid.map(c => (
                <div key={c.t} style={{ minWidth: 260, padding: 14, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>{c.t}</div>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead><tr style={{ color: 'var(--text-tertiary)', fontSize: 11 }}><td></td><td>{c.sa.name}</td><td>{c.sb.name}</td></tr></thead>
                    <tbody>
                      <tr><td style={{ color: 'var(--text-tertiary)', padding: '4px 0' }}>시총</td><td style={{ fontWeight: 600 }}>{fmtCap(c.sa.market_cap,c.sa.currency)}</td><td style={{ fontWeight: 600 }}>{fmtCap(c.sb.market_cap,c.sb.currency)}</td></tr>
                      <tr><td style={{ color: 'var(--text-tertiary)', padding: '4px 0' }}>등락</td>
                        <td style={{ fontWeight: 700, color: (c.sa.change_pct??0)>0?'#22c55e':(c.sa.change_pct??0)<0?'#ef4444':'var(--text-tertiary)' }}>{(c.sa.change_pct??0)>0?'+':''}{(c.sa.change_pct??0).toFixed(2)}%</td>
                        <td style={{ fontWeight: 700, color: (c.sb.change_pct??0)>0?'#22c55e':(c.sb.change_pct??0)<0?'#ef4444':'var(--text-tertiary)' }}>{(c.sb.change_pct??0)>0?'+':''}{(c.sb.change_pct??0).toFixed(2)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 면책 */}
      <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 6, padding: '8px 14px', marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        본 서비스의 주식 정보는 투자 참고용이며 투자 권유가 아닙니다. 투자 손실에 대한 책임은 투자자 본인에게 있습니다.
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
        시세 데이터: Naver Finance / Yahoo Finance API · 20분 지연 · 환율: 1 USD = ₩{exchangeRate.toFixed(0)}
      </p>

      {/* 종목 모달 */}
      {selectedStock && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedStock(null)}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{selectedStock.name}</h2>
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{selectedStock.symbol} · {selectedStock.market}</span>
              </div>
              <button onClick={() => setSelectedStock(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>현재가</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {selectedStock.currency === 'USD' ? `$${selectedStock.price?.toFixed(2)}` : `₩${fmt(selectedStock.price)}`}
                </div>
              </div>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>등락률</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: (selectedStock.change_pct??0)>0?'#22c55e':(selectedStock.change_pct??0)<0?'#ef4444':'var(--text-tertiary)' }}>
                  {(selectedStock.change_pct??0)>0?'▲':'▼'} {Math.abs(selectedStock.change_pct??0).toFixed(2)}%
                </div>
              </div>
            </div>
            <a href={`/stock/${encodeURIComponent(selectedStock.symbol)}`} style={{ display: 'block', textAlign: 'center', background: isDomestic ? 'var(--brand)' : '#3b82f6', color: '#fff', padding: 12, borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
              종목 상세 보기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
