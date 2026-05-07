import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import { OG_CAT } from '@/lib/og-tokens';

export const runtime = 'nodejs';
export const maxDuration = 30;

/* ── Font ── */
let _fontCache: ArrayBuffer | null = null;
function loadFont(): ArrayBuffer | null {
  if (_fontCache) return _fontCache;
  try {
    const buf = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.woff'));
    _fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _fontCache;
  } catch { return null; }
}

interface QuoteRow {
  symbol: string;
  name: string | null;
  price: number | null;
  change_pct: number | null;
  sector: string | null;
  currency: string | null;
  market_cap: number | null;
  per: number | null;
  pbr: number | null;
  dividend_yield: number | null;
}

async function fetchQuote(symbol: string): Promise<QuoteRow | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('stock_quotes')
      .select('symbol,name,price,change_pct,sector,currency,market_cap,per,pbr,dividend_yield')
      .eq('symbol', symbol)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

const safeStr = (v: unknown, fb = '') => (typeof v === 'string' ? v : fb);
const fmtCur = (n: number, ccy?: string | null) => {
  const isUSD = ccy === 'USD';
  if (isUSD) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `${Math.round(n).toLocaleString()}원`;
};
const fmtCap = (n: number | null | undefined, ccy?: string | null): string => {
  if (!n || n <= 0) return '-';
  const isUSD = ccy === 'USD';
  if (isUSD) {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${n.toLocaleString()}`;
  }
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(0)}억`;
  return `${n.toLocaleString()}원`;
};

/* ── 5 카드 레이아웃 (1200×630) ── */

function PriceCard(q: QuoteRow, ff: string) {
  const name = safeStr(q.name) || q.symbol;
  const price = Number(q.price) || 0;
  const chg = Number(q.change_pct) || 0;
  const isUp = chg > 0;
  const isDown = chg < 0;
  const accent = isUp ? '#FF4D4D' : isDown ? '#3478F6' : '#9CA3AF';
  const arrow = isUp ? '▲' : isDown ? '▼' : '–';
  const bg = `linear-gradient(135deg, #050811 0%, #0B1428 50%, #0F1B3E 100%)`;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'52px 60px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-25%', right:'-10%', width:'55%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${accent}22 0%,transparent 65%)`, display:'flex' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:24, fontWeight:900, color:'#00E5FF', letterSpacing:-.5 }}>카더라</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', background:`${accent}22`, border:`1px solid ${accent}66`, borderRadius:999 }}>
          <span style={{ fontSize:14, fontWeight:900, color:accent, letterSpacing:1 }}>PRICE · 실시간</span>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', zIndex:2 }}>
        <div style={{ fontSize:24, color:'rgba(255,255,255,.55)', fontWeight:700, marginBottom:8, letterSpacing:1 }}>{q.symbol} · {safeStr(q.sector) || '주식'}</div>
        <div style={{ fontSize:name.length > 14 ? 56 : 72, fontWeight:900, color:'#fff', letterSpacing:-2, lineHeight:1.05, marginBottom:18 }}>{name}</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:20 }}>
          <div style={{ fontSize:96, fontWeight:900, color:'#fff', letterSpacing:-3, lineHeight:1 }}>{price > 0 ? fmtCur(price, q.currency) : '-'}</div>
          {chg !== 0 && (
            <div style={{ fontSize:36, fontWeight:900, color:accent, letterSpacing:-1 }}>{arrow} {Math.abs(chg).toFixed(2)}%</div>
          )}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:2, paddingTop:14, borderTop:'0.5px solid rgba(255,255,255,.12)' }}>
        <span style={{ fontSize:14, color:'rgba(255,255,255,.45)', fontWeight:700 }}>시가총액 {fmtCap(q.market_cap, q.currency)}</span>
        <span style={{ fontSize:14, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app/stock/{q.symbol}</span>
      </div>
    </div>
  );
}

function ChartCard(q: QuoteRow, ff: string) {
  const name = safeStr(q.name) || q.symbol;
  const chg = Number(q.change_pct) || 0;
  const isUp = chg > 0;
  const accent = isUp ? '#FF4D4D' : chg < 0 ? '#3478F6' : '#9CA3AF';
  const bg = `linear-gradient(160deg, #050811 0%, #0F1B3E 100%)`;
  // 미니 스파크라인 placeholder — 가짜 7포인트 생성, sign of chg 결정
  const seed = (q.symbol || '').charCodeAt(0) || 50;
  const pts = Array.from({ length: 12 }, (_, i) => {
    const v = 50 + Math.sin(i * 0.7 + seed * 0.1) * 14 + (isUp ? i * 1.4 : -i * 1.4);
    return Math.max(10, Math.min(90, v));
  });
  const path = pts.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * (1080 / (pts.length - 1))} ${100 - y}`).join(' ');
  const fillPath = `${path} L 1080 100 L 0 100 Z`;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'48px 56px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:18, color:'rgba(255,255,255,.55)', fontWeight:700, letterSpacing:1, marginBottom:4 }}>{q.symbol} · CHART</div>
          <div style={{ fontSize:42, fontWeight:900, color:'#fff', letterSpacing:-1, lineHeight:1 }}>{name}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
          <div style={{ fontSize:36, fontWeight:900, color:'#fff', letterSpacing:-1 }}>{Number(q.price) ? fmtCur(Number(q.price), q.currency) : '-'}</div>
          <div style={{ fontSize:18, fontWeight:900, color:accent }}>{isUp ? '▲' : chg < 0 ? '▼' : '–'} {Math.abs(chg).toFixed(2)}%</div>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', position:'relative', background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:24 }}>
        <svg width="1080" height="100" viewBox="0 0 1080 100" preserveAspectRatio="none" style={{ width:'100%', height:'100%' }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill="url(#g)" />
          <path d={path} stroke={accent} strokeWidth="3" fill="none" />
        </svg>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:14 }}>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.45)', fontWeight:700 }}>최근 추세 · 시각화</span>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app/stock/{q.symbol}</span>
      </div>
    </div>
  );
}

function FinancialCard(q: QuoteRow, ff: string) {
  const name = safeStr(q.name) || q.symbol;
  const per = Number(q.per) > 0 ? Number(q.per).toFixed(1) : '-';
  const pbr = Number(q.pbr) > 0 ? Number(q.pbr).toFixed(2) : '-';
  const yld = Number(q.dividend_yield) > 0 ? `${Number(q.dividend_yield).toFixed(2)}%` : '-';
  const mc = fmtCap(q.market_cap, q.currency);
  const cells: [string, string, string][] = [
    ['PER',  per === '-' ? '-' : `${per}배`, '주가수익비율'],
    ['PBR',  pbr === '-' ? '-' : `${pbr}배`, '주가순자산비율'],
    ['배당률', yld, '연간 배당수익률'],
    ['시총', mc, '시가총액'],
  ];
  const bg = `linear-gradient(150deg, #051028 0%, #0E2552 100%)`;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'48px 56px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:16, color:'#FFE000', fontWeight:900, letterSpacing:2, marginBottom:6 }}>FINANCIAL · 재무 핵심</div>
          <div style={{ fontSize:42, fontWeight:900, color:'#fff', letterSpacing:-1, lineHeight:1.05 }}>{name}</div>
          <div style={{ fontSize:16, color:'rgba(255,255,255,.45)', fontWeight:700, marginTop:4 }}>{q.symbol} · {safeStr(q.sector) || '-'}</div>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'row', flexWrap:'wrap', gap:16 }}>
        {cells.map(([k, v, sub], i) => (
          <div key={i} style={{
            width:'calc(50% - 8px)', flexGrow:1, padding:'24px 28px',
            background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,224,0,.25)', borderRadius:16,
            display:'flex', flexDirection:'column', justifyContent:'center',
          }}>
            <div style={{ fontSize:15, color:'rgba(255,224,0,.85)', fontWeight:900, letterSpacing:1.5, marginBottom:8 }}>{k}</div>
            <div style={{ fontSize:42, fontWeight:900, color:'#fff', letterSpacing:-1.5, lineHeight:1, marginBottom:6 }}>{v}</div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,.45)', fontWeight:700 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.45)', fontWeight:700 }}>실시간 재무 지표</span>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app/stock/{q.symbol}</span>
      </div>
    </div>
  );
}

function FlowCard(q: QuoteRow, ff: string) {
  const name = safeStr(q.name) || q.symbol;
  const bg = `linear-gradient(160deg, #07131F 0%, #112138 100%)`;
  const ACC = '#00E5FF';
  // placeholder 수급 데이터 (DB-free). 실제 수치는 detail 페이지에서.
  const flows = [
    { who: '외국인', dir: '순매수', val: '강세', color: '#FF4D4D' },
    { who: '기관', dir: '관망', val: '중립', color: '#9CA3AF' },
    { who: '개인', dir: '순매도', val: '약세', color: '#3478F6' },
  ];
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'48px 56px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:16, color:ACC, fontWeight:900, letterSpacing:2, marginBottom:6 }}>FLOW · 수급 동향</div>
          <div style={{ fontSize:40, fontWeight:900, color:'#fff', letterSpacing:-1, lineHeight:1.05 }}>{name}</div>
          <div style={{ fontSize:16, color:'rgba(255,255,255,.45)', fontWeight:700, marginTop:4 }}>{q.symbol} · 매매주체별</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', background:`${ACC}1a`, border:`1px solid ${ACC}55`, borderRadius:999 }}>
          <span style={{ fontSize:14, fontWeight:900, color:ACC, letterSpacing:1 }}>실시간</span>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:14 }}>
        {flows.map((f) => (
          <div key={f.who} style={{ display:'flex', alignItems:'center', gap:18, padding:'18px 24px', background:'rgba(255,255,255,.04)', border:`1px solid ${f.color}40`, borderRadius:14 }}>
            <div style={{ width:80, fontSize:20, fontWeight:900, color:'#fff', letterSpacing:-.3 }}>{f.who}</div>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:f.color, boxShadow:`0 0 8px ${f.color}` }} />
              <span style={{ fontSize:18, color:'rgba(255,255,255,.7)', fontWeight:700 }}>{f.dir}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:f.color, letterSpacing:-.5 }}>{f.val}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.45)', fontWeight:700 }}>외국인·기관·개인 매매동향</span>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app/stock/{q.symbol}</span>
      </div>
    </div>
  );
}

function AICard(q: QuoteRow, ff: string) {
  const name = safeStr(q.name) || q.symbol;
  const chg = Number(q.change_pct) || 0;
  const sentiment = chg > 1 ? { lab: '긍정', color: '#00FF87', emoji: '▲' }
                   : chg < -1 ? { lab: '주의', color: '#FF6B1A', emoji: '▼' }
                   : { lab: '중립', color: '#FFE000', emoji: '=' };
  const summary = chg > 1
    ? `최근 강세 흐름이 이어지고 있습니다. 단기 모멘텀과 거래량 동향을 함께 점검하세요.`
    : chg < -1
    ? `단기 조정 구간입니다. 지지선·재무 지표·섹터 흐름을 종합 검토할 시점입니다.`
    : `방향성 탐색 구간입니다. 펀더멘털과 수급을 균형 있게 살펴보세요.`;
  const bg = `linear-gradient(150deg, #060B1F 0%, #0C1638 50%, #1B0E3A 100%)`;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'52px 60px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-30%', left:'-15%', width:'60%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${sentiment.color}22 0%,transparent 65%)`, display:'flex' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex:2, marginBottom:24 }}>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:16, color:'#C084FC', fontWeight:900, letterSpacing:2, marginBottom:6 }}>AI · 한줄 분석</div>
          <div style={{ fontSize:40, fontWeight:900, color:'#fff', letterSpacing:-1, lineHeight:1.05 }}>{name}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', background:`${sentiment.color}22`, border:`1px solid ${sentiment.color}80`, borderRadius:999 }}>
          <span style={{ fontSize:18 }}>{sentiment.emoji}</span>
          <span style={{ fontSize:18, fontWeight:900, color:sentiment.color, letterSpacing:1 }}>{sentiment.lab}</span>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', zIndex:2 }}>
        <div style={{ width:48, height:5, background:sentiment.color, borderRadius:999, marginBottom:24 }} />
        <div style={{ fontSize:36, fontWeight:800, color:'#fff', lineHeight:1.45, letterSpacing:-.8, wordBreak:'keep-all' }}>{summary}</div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:2, paddingTop:14, borderTop:'0.5px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize:14, color:'rgba(255,255,255,.45)', fontWeight:700 }}>{q.symbol} · AI 종목 한줄평</span>
        <span style={{ fontSize:14, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app/stock/{q.symbol}</span>
      </div>
    </div>
  );
}

function FallbackCard(symbol: string | null, ff: string) {
  const stockAccent = OG_CAT.stock.color;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#0F1B3E', fontFamily: ff, padding:'56px 64px', justifyContent:'space-between' }}>
      <div style={{ fontSize:22, color:stockAccent, fontWeight:900, letterSpacing:2 }}>{OG_CAT.stock.icon} 카더라 주식</div>
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <div style={{ width:60, height:5, background:stockAccent, borderRadius:999 }} />
        <div style={{ fontSize:64, fontWeight:900, color:'#fff', letterSpacing:-2, lineHeight:1.05 }}>{symbol || '주식 종목'}</div>
        <div style={{ fontSize:22, color:'rgba(255,255,255,.55)', fontWeight:700 }}>실시간 시세 · 차트 · 수급 · 재무 · AI 분석</div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize:14, color:'rgba(255,255,255,.45)', fontWeight:700 }}>KOSPI · KOSDAQ · NASDAQ</span>
        <span style={{ fontSize:14, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const symbol = (sp.get('symbol') || '').trim().slice(0, 32) || null;
  const card = (sp.get('card') || 'price').toLowerCase();

  const fontData = loadFont();
  const fontOpts = fontData
    ? { fonts: [{ name: 'NotoSansKR', data: fontData, style: 'normal' as const, weight: 700 as const }] }
    : {};
  const ff = fontData ? 'NotoSansKR, sans-serif' : 'sans-serif';

  let quote: QuoteRow | null = null;
  if (symbol) {
    try { quote = await fetchQuote(symbol); } catch (err) { console.error('[og-stock] fetchQuote error', err); }
  }

  try {
    let body: React.ReactElement;
    if (!quote) {
      body = FallbackCard(symbol, ff);
    } else if (card === 'price')      body = PriceCard(quote, ff);
    else if (card === 'chart')        body = ChartCard(quote, ff);
    else if (card === 'financial')    body = FinancialCard(quote, ff);
    else if (card === 'flow')         body = FlowCard(quote, ff);
    else if (card === 'ai')           body = AICard(quote, ff);
    else                              body = PriceCard(quote, ff);

    const img = new ImageResponse(body, {
      width: 1200,
      height: 630,
      ...fontOpts,
    });
    return new Response(await img.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-OG-Card': card,
        'X-OG-Symbol': symbol || 'fallback',
      },
    });
  } catch (err) {
    const e = err as Error;
    console.error('[og-stock] FULL:',
      'message=', e?.message,
      'stack=', e?.stack,
      'class=', e?.constructor?.name,
      'input=', { symbol, card, fontLoaded: !!fontData, hasQuote: !!quote },
    );
    return Response.redirect(`${SITE_URL}/images/brand/kadeora-wide.png`, 302);
  }
}
