import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { OG_CAT as CAT, type OgCategoryToken } from '@/lib/og-tokens';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
function D1(C: OgCategoryToken, title: string, sub: string, author: string, ff: string) {
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', background:'#060606', fontFamily: ff }}>
      {/* 스트라이프1: 컬러 헤더 */}
      <div style={{ background: C.color, height:72, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 48px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {Logo(26)}<span style={{ fontSize: 'var(--fs-lg)', fontWeight:900, color:'#000' }}>카더라</span>
        </div>
        <span style={{ fontSize: 'var(--fs-md)', fontWeight:900, color:'#000', letterSpacing:1 }}>{C.icon}  {C.label.toUpperCase()}</span>
      </div>
      {/* 스트라이프2: 메타 바 */}
      <div style={{ background:'#111', height:52, display:'flex', alignItems:'center', padding:'0 48px', gap:16, flexShrink:0, borderBottom:'0.5px solid rgba(255,255,255,.06)' }}>
        {author && <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width: 24, height: 24, borderRadius:'50%', background:`linear-gradient(135deg,${C.color},#2563eb)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:'#fff' }}>
            {author[0].toUpperCase()}
          </div>
          <span style={{ fontSize:12, color:'#6b7280' }}>{author}</span>
        </div>}
        <div style={{ flex:1, height:1, background:'rgba(255,255,255,.05)' }} />
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#00FF87', boxShadow:'0 0 5px #00FF87' }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,.25)', letterSpacing:.5 }}>LIVE</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:C.color, padding:'3px 12px', borderRadius: 'var(--radius-sm)', background:C.dim, border:`0.5px solid ${C.color}50` }}>kadeora.app</span>
      </div>
      {/* 스트라이프3: 제목 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 48px' }}>
        <div style={{ fontSize: title.length > 22 ? 38 : title.length > 16 ? 44 : 50, fontWeight:900, color:'#fff', lineHeight:1.18, letterSpacing:-1.5 }}>{title}</div>
        {sub && <div style={{ fontSize: 'var(--fs-base)', color:'#6b7280', marginTop:14, lineHeight:1.55 }}>{sub}</div>}
      </div>
      {/* 스트라이프4: KPI 바 */}
      <div style={{ background:C.dim, borderTop:`0.5px solid ${C.color}30`, height:58, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 48px', flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:900, color:C.color }}>{C.icon}  {C.label}</span>
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
function D2(C: OgCategoryToken, title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 28 : title.length > 16 ? 34 : 40;
  const bg = `linear-gradient(150deg, ${C.bg[0]} 0%, ${C.bg[1]} 55%, ${C.bg[2]} 100%)`;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', overflow:'hidden', fontFamily: ff }}>

      {/* ── 좌측 40%: 순수 컬러 패널 ── */}
      <div style={{ width:'40%', background:C.color, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'32px 28px', position:'relative', overflow:'hidden', flexShrink:0 }}>
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
          <span style={{ fontSize:62, lineHeight:1 }}>{C.icon}</span>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:19, fontWeight:900, color:'#000', letterSpacing:-0.3 }}>{C.label}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(0,0,0,0.42)', letterSpacing:2, marginTop:3 }}>{C.code}</div>
          </div>
        </div>

        {/* 하단: kadeora.app */}
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize: 10, fontWeight:700, color:'rgba(0,0,0,0.28)', letterSpacing:0.5 }}>kadeora.app</div>
        </div>
      </div>

      {/* ── 우측 60%: 다크 그라디언트 ── */}
      <div style={{ flex:1, background: bg, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'28px 32px' }}>

        {/* 상단: 카테고리 뱃지 우상단 */}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', background:C.dim, border:`0.5px solid ${C.color}55`, borderRadius:'var(--radius-pill)' }}>
            <span style={{ fontSize:14 }}>{C.icon}</span>
            <span style={{ fontSize:11, fontWeight:700, color:C.color }}>{C.label}</span>
          </div>
        </div>

        {/* 중앙: 컬러 언더라인 + 제목 + 부제 */}
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {/* 컬러 언더라인 24px */}
          <div style={{ width:24, height:3, background:C.color, borderRadius:'var(--radius-pill)', marginBottom:18 }} />
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
            <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#00FF87' }} />
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)', fontWeight:600, letterSpacing:0.5 }}>LIVE</span>
            </div>
            {author && (
              <>
                <div style={{ width:1, height:12, background:'rgba(255,255,255,0.12)' }} />
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width: 24, height: 24, borderRadius:'50%', background:`linear-gradient(135deg,${C.color},#2563EB)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 10, fontWeight:900, color:'#fff' }}>
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
function D3(C: OgCategoryToken, title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 34 : title.length > 16 ? 40 : 46;
  return (
    <div style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden', background:'#0A0A0A', display:'flex', fontFamily: ff }}>
      {/* 대각선 컬러 삼각형 */}
      <div style={{ position:'absolute', top:0, left:0, width:0, height:0, borderStyle:'solid', borderWidth:'630px 520px 0 0', borderColor:`${C.color} transparent transparent transparent`, display:'flex' }} />
      {/* 왼쪽 컨텐츠 */}
      <div style={{ position:'absolute', top:0, left:0, width:'42%', height:'100%', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'32px 28px', zIndex:2 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom:20 }}>
            {Logo(20)}<span style={{ fontSize:13, fontWeight:900, color:'#000' }}>카더라</span>
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(0,0,0,.5)', letterSpacing:2, marginBottom:4 }}>{C.code}</div>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight:900, color:'#000' }}>{C.label}  {C.icon}</div>
        </div>
        {author && (
          <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:'#000' }}>{author[0].toUpperCase()}</div>
            <span style={{ fontSize:12, color:'rgba(0,0,0,.55)' }}>{author}</span>
          </div>
        )}
        <div style={{ fontSize: 10, color:'rgba(0,0,0,.3)', fontWeight:700 }}>kadeora.app</div>
      </div>
      {/* 오른쪽 컨텐츠 */}
      <div style={{ position:'absolute', top:0, right:0, width:'58%', height:'100%', display:'flex', flexDirection:'column', justifyContent:'center', padding:'32px 36px 32px 48px', zIndex:2 }}>
        <div style={{ width:28, height:2, background:C.color, borderRadius:'var(--radius-pill)', marginBottom:18 }} />
        <div style={{ fontSize:titleFS, fontWeight:900, color:'#fff', lineHeight:1.18, letterSpacing:-1, marginBottom:12 }}>{title}</div>
        {sub && <div style={{ fontSize:14, color:'#4b5563', lineHeight:1.55 }}>{sub}</div>}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:20 }}>
          <span style={{ fontSize:11, color:C.color, fontWeight:700, padding:'3px 10px', background:C.dim, border:`0.5px solid ${C.color}50`, borderRadius:4 }}>{C.label}</span>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   디자인 4: 화이트 미니멀
   좌: 순수 컬러 패널 / 우: 흰 배경 + 타이포
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function D4(C: OgCategoryToken, title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 30 : title.length > 16 ? 36 : 42;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', overflow:'hidden', fontFamily: ff }}>
      {/* 왼쪽 컬러 패널 */}
      <div style={{ width:'42%', background:C.color, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'32px 28px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', bottom:'-25%', right:'-25%', width:'80%', aspectRatio:'1', borderRadius:'50%', background:'rgba(0,0,0,.12)', display:'flex' }} />
        <div style={{ position:'absolute', top:'-15%', left:'-15%', width:'55%', aspectRatio:'1', borderRadius:'50%', background:'rgba(255,255,255,.15)', display:'flex' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom:16 }}>
            {Logo(20)}<span style={{ fontSize:13, fontWeight:900, color:'rgba(0,0,0,.6)' }}>카더라</span>
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(0,0,0,.4)', letterSpacing:2 }}>{C.code}</div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight:900, color:'#000', marginTop:4 }}>{C.label}  {C.icon}</div>
        </div>
        {author && (
          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap: 8 }}>
            <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(0,0,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#000' }}>{author[0].toUpperCase()}</div>
            <span style={{ fontSize:12, color:'rgba(0,0,0,.55)' }}>{author}</span>
          </div>
        )}
        <div style={{ position:'relative', zIndex:1, fontSize: 10, color:'rgba(0,0,0,.3)', fontWeight:700 }}>kadeora.app</div>
      </div>
      {/* 오른쪽 흰 패널 */}
      <div style={{ flex:1, background:'#fff', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>{Logo(20)}</div>
        <div>
          <div style={{ width:28, height:3, background:C.color, borderRadius:'var(--radius-pill)', marginBottom:16 }} />
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
function D5(C: OgCategoryToken, title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 38 : title.length > 16 ? 44 : 52;
  return (
    <div style={{ width:'100%', height:'100%', background:'#000', overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily: ff }}>
      {/* 사선 줄무늬 배경 */}
      <div style={{ position:'absolute', inset:0, backgroundImage:`repeating-linear-gradient(135deg,transparent,transparent 60px,${C.color}06 60px,${C.color}06 61px)`, display:'flex' }} />
      {/* 우상단 글로우 */}
      <div style={{ position:'absolute', top:'-35%', right:'-10%', width:'55%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${C.color}22 0%,transparent 65%)`, display:'flex' }} />
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 40px', flexShrink:0, position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {Logo(22)}<span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>카더라</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', border:`1px solid ${C.color}`, borderRadius:4, background:`${C.color}10` }}>
          <span style={{ fontSize:16 }}>{C.icon}</span>
          <span style={{ fontSize:12, fontWeight:700, color:C.color }}>{C.label}</span>
        </div>
      </div>
      {/* 메인: 제목 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 40px', position:'relative', zIndex:2 }}>
        <div style={{ width:24, height:2, background:C.color, borderRadius:'var(--radius-pill)', marginBottom:16, boxShadow:`0 0 8px ${C.color}` }} />
        <div style={{ fontSize:titleFS, fontWeight:900, color:'#fff', lineHeight:1.14, letterSpacing:-1.2, marginBottom:12 }}>{title}</div>
        {sub && <div style={{ fontSize:15, color:'#374151', lineHeight:1.55 }}>{sub}</div>}
      </div>
      {/* 하단 */}
      <div style={{ display:'flex', alignItems:'center', padding:'14px 40px 20px', position:'relative', zIndex:2, borderTop:`0.5px solid ${C.color}20` }}>
        {author
          ? <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width: 24, height: 24, borderRadius:'50%', background:`${C.color}20`, border:`1px solid ${C.color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:C.color }}>{author[0].toUpperCase()}</div>
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
   카드형 OG (s238) — `card` 파라미터로 5종 레이아웃
   hero / stats / imminent / ranking / region
   DB-free, category+title 만 사용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function CardHero(C: OgCategoryToken, title: string, ff: string) {
  const bg = `linear-gradient(135deg, ${C.bg[0]} 0%, ${C.bg[1]} 50%, ${C.bg[2]} 100%)`;
  const titleFS = title.length > 28 ? 52 : title.length > 18 ? 64 : 76;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'56px 64px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-20%', right:'-10%', width:'55%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${C.color}28 0%,transparent 65%)`, display:'flex' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {Logo(36)}
          <span style={{ fontSize:22, fontWeight:900, color:'#fff' }}>카더라</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 18px', background:`${C.color}22`, border:`1px solid ${C.color}66`, borderRadius:'var(--radius-pill)' }}>
          <span style={{ fontSize:18 }}>{C.icon}</span>
          <span style={{ fontSize:15, fontWeight:800, color:C.color }}>{C.label}</span>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', zIndex:2 }}>
        <div style={{ width:48, height:5, background:C.color, borderRadius:'var(--radius-pill)', marginBottom:24 }} />
        <div style={{ fontSize:titleFS, fontWeight:900, color:'#fff', lineHeight:1.1, letterSpacing:-2, marginBottom:18, wordBreak:'keep-all' }}>{title}</div>
        <div style={{ fontSize:22, color:'rgba(255,255,255,.55)', fontWeight:700, letterSpacing:-.3 }}>kadeora.app · 데이터 기반 한국 투자 정보</div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:2, paddingTop:14, borderTop:'0.5px solid rgba(255,255,255,.12)' }}>
        <span style={{ fontSize:14, color:'rgba(255,255,255,.45)', fontWeight:700, letterSpacing:1 }}>{C.code} · HERO</span>
        <span style={{ fontSize:14, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

function CardStats(C: OgCategoryToken, title: string, ff: string) {
  const bg = `linear-gradient(160deg, ${C.bg[0]} 0%, ${C.bg[2]} 100%)`;
  // 카테고리별 placeholder 통계 (DB-free)
  const stats: Record<string, [string, string][]> = {
    apt: [['청약 일정', '주간'], ['분양중', '실시간'], ['미분양', '월간'], ['실거래가', '일일']],
    blog: [['7,600+', '편'], ['매일', '신규'], ['5개', '카테고리'], ['무료', '구독']],
    stock: [['KOSPI', '실시간'], ['KOSDAQ', '실시간'], ['NASDAQ', '글로벌'], ['수급', '외국인·기관']],
    unsold: [['전국', '집계'], ['시·군·구', '단위'], ['추세', '월간'], ['할인', '분양']],
    finance: [['절세', '전략'], ['투자', '입문'], ['저축', '목표'], ['연금', '설계']],
    general: [['생활', '정보'], ['지역', '소식'], ['정책', '안내'], ['커뮤니티', '소통']],
    local: [['우리동네', '소식'], ['지역', '맛집'], ['편의시설', '검색'], ['생활권', '정보']],
    free: [['자유', '게시판'], ['익명', '가능'], ['실시간', '댓글'], ['커뮤니티', '소통']],
  };
  const grid = stats[Object.keys(CAT).find(k => CAT[k] === C) || 'blog'] || stats.blog;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'48px 56px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {Logo(28)}<span style={{ fontSize:18, fontWeight:900, color:'#fff' }}>카더라</span>
        </div>
        <span style={{ fontSize:14, fontWeight:800, color:C.color, letterSpacing:1.5 }}>{C.icon} STATS · {C.code}</span>
      </div>
      <div style={{ fontSize:42, fontWeight:900, color:'#fff', lineHeight:1.15, letterSpacing:-1, marginBottom:8, wordBreak:'keep-all' }}>{title.length > 22 ? title.slice(0, 21) + '…' : title}</div>
      <div style={{ width:36, height:4, background:C.color, borderRadius:'var(--radius-pill)', marginBottom:28 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'row', gap:18 }}>
        {grid.map(([num, label], i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'22px 16px', background:`${C.color}10`, border:`1px solid ${C.color}40`, borderRadius:14 }}>
            <div style={{ fontSize:32, fontWeight:900, color:C.color, letterSpacing:-1, lineHeight:1.05, marginBottom:6 }}>{num}</div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,.55)', fontWeight:700 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

function CardImminent(_C: OgCategoryToken, title: string, ff: string) {
  // 임박/D-day amber theme — 카테고리 무관 amber 강조
  const A = '#FFB020';
  const bg = `linear-gradient(135deg, #1a0c00 0%, #2a1500 50%, #3a1f00 100%)`;
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'52px 60px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-25%', left:'-10%', width:'60%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${A}22 0%,transparent 65%)`, display:'flex' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex:2, marginBottom:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {Logo(28)}<span style={{ fontSize:18, fontWeight:900, color:'#fff' }}>카더라</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', background:`${A}24`, border:`1px solid ${A}80`, borderRadius:'var(--radius-pill)' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:A, boxShadow:`0 0 10px ${A}` }} />
          <span style={{ fontSize:14, fontWeight:900, color:A, letterSpacing:1 }}>URGENT · 임박</span>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', zIndex:2 }}>
        <div style={{ fontSize:80, fontWeight:900, color:A, letterSpacing:-3, lineHeight:1, marginBottom:18 }}>D-7</div>
        <div style={{ width:48, height:4, background:A, borderRadius:'var(--radius-pill)', marginBottom:18 }} />
        <div style={{ fontSize:title.length > 22 ? 40 : 50, fontWeight:900, color:'#fff', lineHeight:1.15, letterSpacing:-1, marginBottom:14, wordBreak:'keep-all' }}>{title}</div>
        <div style={{ fontSize:20, color:'rgba(255,255,255,.55)', fontWeight:700 }}>마감 임박 · 놓치지 마세요</div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:2 }}>
        <span style={{ fontSize:13, color:`${A}aa`, fontWeight:800, letterSpacing:1 }}>IMMINENT · 추천</span>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

function CardRanking(C: OgCategoryToken, title: string, ff: string) {
  const bg = `linear-gradient(170deg, ${C.bg[0]} 0%, ${C.bg[1]} 100%)`;
  const top3 = [
    { rank: 1, label: 'TOP 1', sub: '실시간 1위' },
    { rank: 2, label: 'TOP 2', sub: '주목 종목/단지' },
    { rank: 3, label: 'TOP 3', sub: '인기 급상승' },
  ];
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'46px 56px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {Logo(28)}<span style={{ fontSize:18, fontWeight:900, color:'#fff' }}>카더라</span>
        </div>
        <span style={{ fontSize:14, fontWeight:900, color:C.color, letterSpacing:2 }}>RANKING · {C.code}</span>
      </div>
      <div style={{ fontSize:38, fontWeight:900, color:'#fff', lineHeight:1.15, letterSpacing:-1, marginBottom:6, wordBreak:'keep-all' }}>{title.length > 24 ? title.slice(0, 23) + '…' : title}</div>
      <div style={{ width:40, height:4, background:C.color, borderRadius:'var(--radius-pill)', marginBottom:22 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>
        {top3.map((r) => (
          <div key={r.rank} style={{ display:'flex', alignItems:'center', gap:18, padding:'16px 22px', background:`${C.color}0c`, border:`1px solid ${C.color}30`, borderRadius:14 }}>
            <div style={{ width:54, height:54, borderRadius:12, background:C.color, color:'#000', fontSize:28, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{r.rank}</div>
            <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
              <div style={{ fontSize:24, fontWeight:900, color:'#fff', letterSpacing:-.5, marginBottom:3 }}>{r.label}</div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,.55)', fontWeight:700 }}>{r.sub}</div>
            </div>
            <span style={{ fontSize:22 }}>{C.icon}</span>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

function CardRegion(C: OgCategoryToken, title: string, ff: string) {
  const bg = `linear-gradient(150deg, ${C.bg[0]} 0%, ${C.bg[1]} 60%, ${C.bg[2]} 100%)`;
  const regions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '세종'];
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:bg, fontFamily: ff, padding:'46px 56px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {Logo(28)}<span style={{ fontSize:18, fontWeight:900, color:'#fff' }}>카더라</span>
        </div>
        <span style={{ fontSize:14, fontWeight:900, color:C.color, letterSpacing:2 }}>REGION · 전국</span>
      </div>
      <div style={{ fontSize:38, fontWeight:900, color:'#fff', lineHeight:1.15, letterSpacing:-1, marginBottom:8, wordBreak:'keep-all' }}>{title.length > 24 ? title.slice(0, 23) + '…' : title}</div>
      <div style={{ width:40, height:4, background:C.color, borderRadius:'var(--radius-pill)', marginBottom:18 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'row', flexWrap:'wrap', gap:12, alignContent:'flex-start' }}>
        {regions.map((r, i) => (
          <div key={r} style={{
            width:'calc(25% - 9px)', padding:'18px 14px', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center',
            background: i === 0 ? `${C.color}28` : `${C.color}10`,
            border: i === 0 ? `1px solid ${C.color}` : `1px solid ${C.color}30`,
            borderRadius:12,
          }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{C.icon}</div>
            <div style={{ fontSize:18, fontWeight:900, color:'#fff', letterSpacing:-.5 }}>{r}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:14 }}>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.45)', fontWeight:800 }}>{C.label} 지역별</span>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.35)', fontWeight:700 }}>kadeora.app</span>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   디자인 6: 그라디언트 풀컬러
   배경 전체가 컬러 그라디언트 + 반투명 카드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function D6(C: OgCategoryToken, title: string, sub: string, author: string, ff: string) {
  const titleFS = title.length > 22 ? 36 : title.length > 16 ? 42 : 48;
  const bg = `linear-gradient(135deg, ${C.bg[0]} 0%, ${C.bg[1]} 45%, ${C.bg[2]} 100%)`;
  return (
    <div style={{ width:'100%', height:'100%', overflow:'hidden', position:'relative', background:bg, display:'flex', flexDirection:'column', fontFamily: ff }}>
      {/* 배경 글로우 원 */}
      <div style={{ position:'absolute', top:'-30%', right:'-10%', width:'60%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${C.color}25 0%,transparent 65%)`, display:'flex' }} />
      <div style={{ position:'absolute', bottom:'-25%', left:'-5%', width:'45%', aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${C.color}15 0%,transparent 65%)`, display:'flex' }} />
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'22px 44px 0', flexShrink:0, position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {Logo(24)}<span style={{ fontSize:15, fontWeight:700, color:'rgba(255,255,255,.55)' }}>카더라</span>
        </div>
        <div style={{ padding:'5px 16px', background:'rgba(255,255,255,.12)', border:'0.5px solid rgba(255,255,255,.25)', borderRadius:'var(--radius-pill)' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{C.icon}  {C.label}</span>
        </div>
      </div>
      {/* 메인 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 44px', position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <div style={{ width:28, height:2, background:'rgba(255,255,255,.6)', borderRadius:'var(--radius-pill)' }} />
          <span style={{ fontSize:12, color:'rgba(255,255,255,.5)', letterSpacing:1.5, fontWeight:700 }}>{C.code}</span>
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
    const card     = sp.get('card');             // s238: hero/stats/imminent/ranking/region
    const likes    = sp.get('likes') ?? '0';
    const comments = sp.get('comments') ?? '0';

    const C = CAT[category] ?? CAT.blog;
    const titleTrim = title.length > 48 ? title.slice(0, 47) + '…' : title;
    const subTrim   = subtitle.length > 68 ? subtitle.slice(0, 67) + '…' : subtitle;

    /* s238: 카드형 OG (메인 페이지 6장 전략) */
    if (card) {
      const cardTitle = titleTrim || (CAT[category] ? CAT[category].label : '카더라');
      const cardMap: Record<string, any> = {
        hero:     CardHero(C, cardTitle, ff),
        stats:    CardStats(C, cardTitle, ff),
        imminent: CardImminent(C, cardTitle, ff),
        ranking:  CardRanking(C, cardTitle, ff),
        region:   CardRegion(C, cardTitle, ff),
      };
      const cardEl = cardMap[card];
      if (cardEl) {
        const _cardImg = new ImageResponse(cardEl, { width:1200, height:630, ...opts });
        const _cardBuf = await _cardImg.arrayBuffer();
        return new Response(_cardBuf, { headers: { 'Content-Type':'image/png', 'X-OG-Card': card, ...CACHE } });
      }
    }

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
      const _homeImg = new ImageResponse(D1(homeC, '아는 사람만 아는 그 정보', '주식 · 청약·분양 · 재테크 · 커뮤니티 · 7,600편+ 블로그', '카더라', ff), { width:1200, height:630, ...opts });
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

  } catch (err) {
    // s240 W2: chunk 분할 강화 — Vercel MCP get_runtime_logs Message 컬럼 ~30자 truncate 우회.
    // 80자 단위로 잘라 prefix 포함 한 줄 < 100자 보장.
    const e = err as Error;
    const msg = e?.message ?? '';
    const stk = e?.stack ?? '';
    const cls = e?.constructor?.name ?? '';
    const inp = JSON.stringify({
      title: new URL(req.url).searchParams.get('title')?.slice(0, 40),
      card: new URL(req.url).searchParams.get('card'),
      design: new URL(req.url).searchParams.get('design'),
      category: new URL(req.url).searchParams.get('category'),
    });
    console.error('[og] cls=', cls);
    for (let i = 0; i < msg.length; i += 80) console.error('[og] m' + (i / 80) + '=', msg.slice(i, i + 80));
    for (let i = 0; i < Math.min(stk.length, 480); i += 80) console.error('[og] s' + (i / 80) + '=', stk.slice(i, i + 80));
    for (let i = 0; i < inp.length; i += 80) console.error('[og] i' + (i / 80) + '=', inp.slice(i, i + 80));
    const cat = new URL(req.url).searchParams.get('category') ?? 'default';
    const fb: Record<string,string> = { stock:`${SITE}/images/brand/kadeora-wide.png`, apt:`${SITE}/images/brand/kadeora-full.png`, default:`${SITE}/images/brand/kadeora-hero.png` };
    return Response.redirect(fb[cat] ?? fb.default, 302);
  }
}
