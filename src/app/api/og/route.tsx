import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';
export const maxDuration = 30;

/* ── 카테고리 설정 ── */
const CAT: Record<string, { a: string; b: string; g: [string,string,string]; L: string; I: string; E: string }> = {
  apt:     { a:'#00FF87', b:'rgba(0,255,135,.18)',   g:['#010804','#031509','#05230E'], L:'청약·분양',   I:'🏢', E:'APT'     },
  stock:   { a:'#00E5FF', b:'rgba(0,229,255,.18)',   g:['#010508','#031020','#051830'], L:'주식·시세',   I:'📈', E:'STOCK'   },
  finance: { a:'#FFE000', b:'rgba(255,224,0,.18)',   g:['#070500','#140E00','#201500'], L:'재테크·절세', I:'💰', E:'FINANCE' },
  unsold:  { a:'#FF6B1A', b:'rgba(255,107,26,.18)',  g:['#070100','#140500','#210900'], L:'미분양',      I:'⚠️', E:'UNSOLD'  },
  general: { a:'#C084FC', b:'rgba(192,132,252,.18)', g:['#030108','#080518','#0D0825'], L:'생활정보',   I:'📰', E:'INFO'    },
  blog:    { a:'#C084FC', b:'rgba(192,132,252,.18)', g:['#030108','#080518','#0D0825'], L:'블로그',      I:'✍️', E:'BLOG'    },
  local:   { a:'#FFD43B', b:'rgba(255,212,59,.18)',  g:['#080700','#141000','#201800'], L:'우리동네',   I:'📍', E:'LOCAL'   },
  free:    { a:'#F472B6', b:'rgba(244,114,182,.18)', g:['#080210','#130820','#1E0F30'], L:'자유',        I:'💬', E:'FREE'    },
};

import { SITE_URL as SITE } from '@/lib/constants';

/* ── 폰트: Node.js fs.readFileSync — 100% 확실 ──
   Edge Runtime의 import.meta.url/fetch 불안정 → Node.js로 전환
   public/fonts/에서 직접 읽기, 캐시되므로 cold start 1회만
── */
let _fontCache: ArrayBuffer | null = null;
function loadFont(): ArrayBuffer | null {
  if (_fontCache) return _fontCache;
  try {
    const buf = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.woff'));
    _fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _fontCache;
  } catch { return null; }
}

function fo(d: ArrayBuffer | null) {
  return d ? { fonts: [{ name: 'NK', data: d, style: 'normal' as const, weight: 700 as const }] } : {};
}

/* ── 로고 SVG ── */
function Logo(size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72">
      <defs>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F1B3E" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect width="72" height="72" rx="18" fill="url(#lg)" />
      <circle cx="18" cy="36" r="7" fill="white" />
      <circle cx="36" cy="36" r="7" fill="white" />
      <circle cx="54" cy="36" r="7" fill="white" />
    </svg>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   디자인 1: 수평 스트라이프 (기본)
   컬러 헤더띠 → 정보바 → 제목 → 컬러 KPI바
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function D1(C: typeof CAT[string], title: string, sub: string, author: string, ff: string) {
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', background:'#060606', fontFamily: ff }}>
      {/* 스트라이프1: 컬러 헤더 */}
      <div style={{ background: C.a, height:72, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 48px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {Logo(26)}<span style={{ fontSize: 'var(--fs-lg)', fontWeight:900, color:'#000' }}>카더라</span>
        </div>
        <span style={{ fontSize: 'var(--fs-md)', fontWeight:900, color:'#000', letterSpacing:1 }}>{C.I}  {C.L.toUpperCase()}</span>
      </div>
      {/* 스트라이프2: 메타 바 */}
      <div style={{ background:'#111', height:52, display:'flex', alignItems:'center', padding:'0 48px', gap:16, flexShrink:0, borderBottom:'0.5px solid rgba(255,255,255,.06)' }}>
        {author && <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:22, height:22, borderRadius:'50%', background:`linear-gradient(135deg,${C.a},#2563eb)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:'#fff' }}>
            {author[0].toUpperCase()}
          </div>
          <span style={{ fontSize:12, color:'#6b7280' }}>{author}</span>
        </div>}
        <div style={{ flex:1, height:1, background:'rgba(255,255,255,.05)' }} />
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#00FF87', boxShadow:'0 0 5px #00FF87' }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,.25)', letterSpacing:.5 }}>LIVE</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:C.a, padding:'3px 12px', borderRadius:6, background:C.b, border:`0.5px solid ${C.a}50` }}>kadeora.app</span>
      </div>
      {/* 스트라이프3: 제목 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 48px' }}>
        <div style={{ fontSize: title.length > 22 ? 38 : title.length > 16 ? 44 : 50, fontWeight:900, color:'#fff', lineHeight:1.18, letterSpacing:-1.5 }}>{title}</div>
        {sub && <div style={{ fontSize: 'var(--fs-base)', color:'#6b7280', marginTop:14, lineHeight:1.55 }}>{sub}</div>}
      </div>
      {/* 스트라이프4: KPI 바 */}
      <div style={{ background:C.b, borderTop:`0.5px solid ${C.a}30`, height:58, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 48px', flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:900, color:C.a }}>{C.I}  {C.L}</span>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.2)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   디자인 2: 풀컬러 좌측
   좌 40% = 카테고리 acColor 배경 (원형 장식 2개 + 대형 이모지 + 카테고리명)
   우 60% = 다크 그라디언트 (카테고리 뱃지 + 제목 + 부제 + LIVE 바)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function D2(C: typeof CAT[string], title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 28 : title.length > 16 ? 34 : 40;
  const bg = `linear-gradient(150deg, ${C.g[0]} 0%, ${C.g[1]} 55%, ${C.g[2]} 100%)`;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', overflow:'hidden', fontFamily: ff }}>

      {/* ── 좌측 40%: 순수 컬러 패널 ── */}
      <div style={{ width:'40%', background:C.a, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'32px 28px', position:'relative', overflow:'hidden', flexShrink:0 }}>
        {/* 원형 장식 1 — 우하단 큰 원 */}
        <div style={{ position:'absolute', bottom:'-28%', right:'-28%', width:'85%', aspectRatio:'1', borderRadius:'50%', background:'rgba(0,0,0,0.14)', display:'flex' }} />
        {/* 원형 장식 2 — 좌상단 작은 원 */}
        <div style={{ position:'absolute', top:'-18%', left:'-18%', width:'58%', aspectRatio:'1', borderRadius:'50%', background:'rgba(255,255,255,0.13)', display:'flex' }} />

        {/* 상단: 로고 */}
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:8 }}>
          {Logo(20)}
          <span style={{ fontSize:13, fontWeight:700, color:'rgba(0,0,0,0.55)', letterSpacing:0.2 }}>카더라</span>
        </div>

        {/* 중앙: 대형 이모지 + 카테고리 */}
        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:62, lineHeight:1 }}>{C.I}</span>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:19, fontWeight:900, color:'#000', letterSpacing:-0.3 }}>{C.L}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(0,0,0,0.42)', letterSpacing:2, marginTop:3 }}>{C.E}</div>
          </div>
        </div>

        {/* 하단: kadeora.app */}
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(0,0,0,0.28)', letterSpacing:0.5 }}>kadeora.app</div>
        </div>
      </div>

      {/* ── 우측 60%: 다크 그라디언트 ── */}
      <div style={{ flex:1, background: bg, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'28px 32px' }}>

        {/* 상단: 카테고리 뱃지 우상단 */}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', background:C.b, border:`0.5px solid ${C.a}55`, borderRadius:99 }}>
            <span style={{ fontSize:14 }}>{C.I}</span>
            <span style={{ fontSize:11, fontWeight:700, color:C.a }}>{C.L}</span>
          </div>
        </div>

        {/* 중앙: 컬러 언더라인 + 제목 + 부제 */}
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {/* 컬러 언더라인 24px */}
          <div style={{ width:24, height:3, background:C.a, borderRadius:99, marginBottom:18 }} />
          {/* 제목 */}
          <div style={{ fontSize:titleFS, fontWeight:900, color:'#ffffff', lineHeight:1.18, letterSpacing:-0.8, marginBottom:14, wordBreak:'keep-all' }}>
            {title}
          </div>
          {/* 부제 */}
          {sub && (
            <div style={{ fontSize:15, color:'rgba(255,255,255,0.38)', lineHeight:1.6, letterSpacing:-0.1 }}>
              {sub}
            </div>
          )}
        </div>

        {/* 하단: LIVE + 저자 + kadeora.app */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:14, borderTop:'0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* LIVE 도트 */}
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#00FF87' }} />
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)', fontWeight:600, letterSpacing:0.5 }}>LIVE</span>
            </div>
            {author && (
              <>
                <div style={{ width:1, height:12, background:'rgba(255,255,255,0.12)' }} />
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:`linear-gradient(135deg,${C.a},#2563EB)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900, color:'#fff' }}>
                    {author[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>{author}</span>
                </div>
              </>
            )}
          </div>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.18)', fontWeight:700, letterSpacing:0.3 }}>kadeora.app</span>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   디자인 3: 대각선 스플릿
   좌상→우하 대각선으로 컬러/블랙 분할
   왼쪽: 카테고리+저자 / 오른쪽: 제목
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function D3(C: typeof CAT[string], title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 34 : title.length > 16 ? 40 : 46;
  return (
    <div style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden', background:'#0A0A0A', display:'flex', fontFamily: ff }}>
      {/* 대각선 컬러 삼각형 */}
      <div style={{ position:'absolute', top:0, left:0, width:0, height:0, borderStyle:'solid', borderWidth:'630px 520px 0 0', borderColor:`${C.a} transparent transparent transparent`, display:'flex' }} />
      {/* 왼쪽 컨텐츠 */}
      <div style={{ position:'absolute', top:0, left:0, width:'42%', height:'100%', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'32px 28px', zIndex:2 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:20 }}>
            {Logo(20)}<span style={{ fontSize:13, fontWeight:900, color:'#000' }}>카더라</span>
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(0,0,0,.5)', letterSpacing:2, marginBottom:4 }}>{C.E}</div>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight:900, color:'#000' }}>{C.L}  {C.I}</div>
        </div>
        {author && (
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:'#000' }}>{author[0].toUpperCase()}</div>
            <span style={{ fontSize:12, color:'rgba(0,0,0,.55)' }}>{author}</span>
          </div>
        )}
        <div style={{ fontSize:9, color:'rgba(0,0,0,.3)', fontWeight:700 }}>kadeora.app</div>
      </div>
      {/* 오른쪽 컨텐츠 */}
      <div style={{ position:'absolute', top:0, right:0, width:'58%', height:'100%', display:'flex', flexDirection:'column', justifyContent:'center', padding:'32px 36px 32px 48px', zIndex:2 }}>
        <div style={{ width:28, height:2, background:C.a, borderRadius:99, marginBottom:18 }} />
        <div style={{ fontSize:titleFS, fontWeight:900, color:'#fff', lineHeight:1.18, letterSpacing:-1, marginBottom:12 }}>{title}</div>
        {sub && <div style={{ fontSize:14, color:'#4b5563', lineHeight:1.55 }}>{sub}</div>}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:20 }}>
          <span style={{ fontSize:11, color:C.a, fontWeight:700, padding:'3px 10px', background:C.b, border:`0.5px solid ${C.a}50`, borderRadius:4 }}>{C.L}</span>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   디자인 4: 화이트 미니멀
   좌: 순수 컬러 패널 / 우: 흰 배경 + 타이포
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function D4(C: typeof CAT[string], title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 30 : title.length > 16 ? 36 : 42;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', overflow:'hidden', fontFamily: ff }}>
      {/* 왼쪽 컬러 패널 */}
      <div style={{ width:'42%', background:C.a, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'32px 28px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', bottom:'-25%', right:'-25%', width:'80%', aspectRatio:'1', borderRadius:'50%', background:'rgba(0,0,0,.12)', display:'flex' }} />
        <div style={{ position:'absolute', top:'-15%', left:'-15%', width:'55%', aspectRatio:'1', borderRadius:'50%', background:'rgba(255,255,255,.15)', display:'flex' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:16 }}>
            {Logo(20)}<span style={{ fontSize:13, fontWeight:900, color:'rgba(0,0,0,.6)' }}>카더라</span>
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(0,0,0,.4)', letterSpacing:2 }}>{C.E}</div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight:900, color:'#000', marginTop:4 }}>{C.L}  {C.I}</div>
        </div>
        {author && (
          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(0,0,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#000' }}>{author[0].toUpperCase()}</div>
            <span style={{ fontSize:12, color:'rgba(0,0,0,.55)' }}>{author}</span>
          </div>
        )}
        <div style={{ position:'relative', zIndex:1, fontSize:9, color:'rgba(0,0,0,.3)', fontWeight:700 }}>kadeora.app</div>
      </div>
      {/* 오른쪽 흰 패널 */}
      <div style={{ flex:1, background:'#fff', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>{Logo(20)}</div>
        <div>
          <div style={{ width:28, height:3, background:C.a, borderRadius:99, marginBottom:16 }} />
          <div style={{ fontSize:titleFS, fontWeight:900, color:'#111', lineHeight:1.18, letterSpacing:-.8, marginBottom:10 }}>{title}</div>
          {sub && <div style={{ fontSize:13, color:'#9ca3af', lineHeight:1.55 }}>{sub}</div>}
        </div>
        <div style={{ borderTop:'0.5px solid #f3f4f6', paddingTop:12, display:'flex', justifyContent:'flex-end' }}>
          <span style={{ fontSize:11, color:'#d1d5db', fontWeight:700 }}>kadeora.app</span>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   디자인 5: 네온 사이버펑크
   순수 블랙 + 사선 줄무늬 + 네온 타이포
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function D5(C: typeof CAT[string], title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 38 : title.length > 16 ? 44 : 52;
  return (
    <div style={{ width:'100%', height:'100%', background:'#000', overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily: ff }}>
      {/* 사선 줄무늬 배경 */}
      <div style={{ position:'absolute', inset:0, backgroundImage:`repeating-linear-gradient(135deg,transparent,transparent 60px,${C.a}06 60px,${C.a}06 61px)`, display:'flex' }} />
      {/* 우상단 글로우 */}
      <div style={{ position:'absolute', top:'-35%', right:'-10%', width:'55%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${C.a}22 0%,transparent 65%)`, display:'flex' }} />
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 40px', flexShrink:0, position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {Logo(22)}<span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>카더라</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', border:`1px solid ${C.a}`, borderRadius:4, background:`${C.a}10` }}>
          <span style={{ fontSize:16 }}>{C.I}</span>
          <span style={{ fontSize:12, fontWeight:700, color:C.a }}>{C.L}</span>
        </div>
      </div>
      {/* 메인: 제목 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 40px', position:'relative', zIndex:2 }}>
        <div style={{ width:24, height:2, background:C.a, borderRadius:99, marginBottom:16, boxShadow:`0 0 8px ${C.a}` }} />
        <div style={{ fontSize:titleFS, fontWeight:900, color:'#fff', lineHeight:1.14, letterSpacing:-1.2, marginBottom:12 }}>{title}</div>
        {sub && <div style={{ fontSize:15, color:'#374151', lineHeight:1.55 }}>{sub}</div>}
      </div>
      {/* 하단 */}
      <div style={{ display:'flex', alignItems:'center', padding:'14px 40px 20px', position:'relative', zIndex:2, borderTop:`0.5px solid ${C.a}20` }}>
        {author
          ? <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:`${C.a}20`, border:`1px solid ${C.a}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:C.a }}>{author[0].toUpperCase()}</div>
              <span style={{ fontSize:12, color:'#4b5563' }}>{author}</span>
            </div>
          : <span style={{ fontSize:12, color:'#1f2937' }}>카더라</span>
        }
        <div style={{ flex:1 }} />
        <span style={{ fontSize:11, color:'rgba(255,255,255,.15)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   디자인 6: 그라디언트 풀컬러
   배경 전체가 컬러 그라디언트 + 반투명 카드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function D6(C: typeof CAT[string], title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 36 : title.length > 16 ? 42 : 48;
  const bg = `linear-gradient(135deg, ${C.g[0]} 0%, ${C.g[1]} 45%, ${C.g[2]} 100%)`;
  return (
    <div style={{ width:'100%', height:'100%', overflow:'hidden', position:'relative', background:bg, display:'flex', flexDirection:'column', fontFamily: ff }}>
      {/* 배경 글로우 원 */}
      <div style={{ position:'absolute', top:'-30%', right:'-10%', width:'60%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${C.a}25 0%,transparent 65%)`, display:'flex' }} />
      <div style={{ position:'absolute', bottom:'-25%', left:'-5%', width:'45%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${C.a}15 0%,transparent 65%)`, display:'flex' }} />
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'22px 44px 0', flexShrink:0, position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {Logo(24)}<span style={{ fontSize:15, fontWeight:700, color:'rgba(255,255,255,.55)' }}>카더라</span>
        </div>
        <div style={{ padding:'5px 16px', background:'rgba(255,255,255,.12)', border:'0.5px solid rgba(255,255,255,.25)', borderRadius:99 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{C.I}  {C.L}</span>
        </div>
      </div>
      {/* 메인 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 44px', position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <div style={{ width:28, height:2, background:'rgba(255,255,255,.6)', borderRadius:99 }} />
          <span style={{ fontSize:12, color:'rgba(255,255,255,.5)', letterSpacing:1.5, fontWeight:700 }}>{C.E}</span>
        </div>
        <div style={{ fontSize:titleFS, fontWeight:900, color:'#fff', lineHeight:1.15, letterSpacing:-1.2, marginBottom:12 }}>{title}</div>
        {sub && <div style={{ fontSize:16, color:'rgba(255,255,255,.5)', lineHeight:1.55 }}>{sub}</div>}
      </div>
      {/* 하단 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 44px 22px', position:'relative', zIndex:2 }}>
        {author
          ? <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:'#fff' }}>{author[0].toUpperCase()}</div>
              <span style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>{author}</span>
            </div>
          : <span style={{ fontSize:12, color:'rgba(255,255,255,.35)' }}>카더라</span>
        }
        <span style={{ fontSize:12, color:'rgba(255,255,255,.25)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

/* ── GET handler ── */
export async function GET(req: NextRequest) {
  try {
    const fontData = loadFont();
    const ff = fontData ? 'NK, sans-serif' : 'sans-serif';
    const opts = fo(fontData);
    const CACHE = {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
    };

    const sp       = new URL(req.url).searchParams;
    const title    = sp.get('title') ?? '';
    const subtitle = sp.get('subtitle') ?? '';
    const author   = sp.get('author') ?? '';
    const category = sp.get('category') ?? 'blog';
    const design   = sp.get('design') ?? '2';   // 1~6 (기본: D2 풀컬러 좌측)
    const section  = sp.get('section');
    const likes    = sp.get('likes') ?? '0';
    const comments = sp.get('comments') ?? '0';

    const C = CAT[category] ?? CAT.blog;
    const titleTrim = title.length > 48 ? title.slice(0, 47) + '…' : title;
    const subTrim   = subtitle.length > 68 ? subtitle.slice(0, 67) + '…' : subtitle;

    /* 섹션 OG */
    if (section) {
      const SEC: Record<string, { title: string; sub: string }> = {
        'stock-kr':         { title:'국내 주식 시세',    sub:'KOSPI · KOSDAQ 실시간 시세 · 종목별 수급 분석' },
        'stock-us':         { title:'해외 주식 시세',    sub:'NASDAQ · S&P 500 · 글로벌 주요 종목' },
        'stock-heatmap':    { title:'섹터 히트맵',       sub:'업종별 등락률 한눈에 — 반도체·금융·바이오·IT' },
        'apt-region':       { title:'전국 부동산 현황',  sub:'지역별 청약·분양·미분양·재개발 현황' },
        'apt-calendar':     { title:'청약 캘린더',       sub:'이번 달 접수중·예정 청약 일정 모아보기' },
        'apt-subscription': { title:'전국 청약 현황',    sub:'접수중 · 예정 · 마감 청약 정보 전체' },
      };
      const s = SEC[section] ?? { title:'카더라', sub:'대한민국 소리소문 정보 커뮤니티' };
      const _secImg = new ImageResponse(D1(C, s.title, s.sub, '', ff), { width:1200, height:630, ...opts });
      const _secBuf = await _secImg.arrayBuffer();
      return new Response(_secBuf, { headers: { 'Content-Type':'image/png', ...CACHE } });
    }

    /* 홈 OG */
    if (!title) {
      const homeC = CAT.apt;
      const _homeImg = new ImageResponse(D1(homeC, '아는 사람만 아는 그 정보', '주식 · 청약·분양 · 재테크 · 커뮤니티 · 19,000편+ 블로그', '카더라', ff), { width:1200, height:630, ...opts });
      const _homeBuf = await _homeImg.arrayBuffer();
      return new Response(_homeBuf, { headers: { 'Content-Type':'image/png', ...CACHE } });
    }

    /* 포스트 OG — design 파라미터로 선택 */
    const designMap: Record<string, any> = {
      '1': D1(C, titleTrim, subTrim, author, ff),
      '2': D2(C, titleTrim, subTrim, author, ff),
      '3': D3(C, titleTrim, subTrim, author, ff),
      '4': D4(C, titleTrim, subTrim, author, ff),
      '5': D5(C, titleTrim, subTrim, author, ff),
      '6': D6(C, titleTrim, subTrim, author, ff),
    };
    const el = designMap[design] ?? designMap['1'];

    const _postImg = new ImageResponse(el, { width: 1200, height: 630, ...opts });
    const _postBuf = await _postImg.arrayBuffer();
    return new Response(_postBuf, { headers: { 'Content-Type':'image/png', 'X-Content-Type-Options':'nosniff', ...CACHE } });

  } catch {
    const cat = new URL(req.url).searchParams.get('category') ?? 'default';
    const fb: Record<string,string> = { stock:`${SITE}/images/brand/kadeora-wide.png`, apt:`${SITE}/images/brand/kadeora-full.png`, default:`${SITE}/images/brand/kadeora-hero.png` };
    return Response.redirect(fb[cat] ?? fb.default, 302);
  }
}
