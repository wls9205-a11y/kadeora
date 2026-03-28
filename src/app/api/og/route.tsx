import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const CAT: Record<string, { color: string; dim: string; bg: [string,string,string]; label: string; icon: string; en: string }> = {
  apt:     { color: '#00FF87', dim: 'rgba(0,255,135,0.15)',   bg: ['#010804','#031509','#05230E'], label: '청약·분양',   icon: '🏢', en: 'APT' },
  stock:   { color: '#00E5FF', dim: 'rgba(0,229,255,0.15)',   bg: ['#010508','#031020','#051830'], label: '주식·시세',   icon: '📈', en: 'STOCK' },
  finance: { color: '#FFE000', dim: 'rgba(255,224,0,0.15)',   bg: ['#070500','#140E00','#201500'], label: '재테크·절세', icon: '💰', en: 'FINANCE' },
  unsold:  { color: '#FF6B1A', dim: 'rgba(255,107,26,0.15)',  bg: ['#070100','#140500','#210900'], label: '미분양',      icon: '⚠️', en: 'UNSOLD' },
  general: { color: '#C084FC', dim: 'rgba(192,132,252,0.15)', bg: ['#030108','#080518','#0D0825'], label: '생활정보',   icon: '📰', en: 'INFO' },
  blog:    { color: '#C084FC', dim: 'rgba(192,132,252,0.15)', bg: ['#030108','#080518','#0D0825'], label: '블로그',      icon: '✍️', en: 'BLOG' },
  local:   { color: '#FFD43B', dim: 'rgba(255,212,59,0.15)',  bg: ['#080700','#141000','#201800'], label: '우리동네',   icon: '📍', en: 'LOCAL' },
  free:    { color: '#F472B6', dim: 'rgba(244,114,182,0.15)', bg: ['#080210','#130820','#1E0F30'], label: '자유',        icon: '💬', en: 'FREE' },
};

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://kadeora.app';

let cachedFont: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer | null> {
  if (cachedFont) return cachedFont;
  try {
    const res = await fetch(`${SITE}/fonts/NotoSansKR-Bold.woff`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) { cachedFont = await res.arrayBuffer(); return cachedFont; }
  } catch { /* ignore */ }
  return null;
}

function fontOpts(data: ArrayBuffer | null) {
  return data ? { fonts: [{ name: 'NK', data, style: 'normal' as const, weight: 700 as const }] } : {};
}

const FALLBACK: Record<string, string> = {
  stock:   `${SITE}/images/brand/kadeora-wide.png`,
  apt:     `${SITE}/images/brand/kadeora-full.png`,
  default: `${SITE}/images/brand/kadeora-hero.png`,
};

/* ─────────────────────────────────────────────
   LogoSVG 컴포넌트
───────────────────────────────────────────── */
function LogoSVG({ size }: { size: number }) {
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

export async function GET(req: NextRequest) {
  try {
    const fontData = await loadFont();
    const ff = fontData ? 'NK, sans-serif' : 'sans-serif';
    const opts = fontOpts(fontData);
    const CACHE = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' };

    const sp       = new URL(req.url).searchParams;
    const title    = sp.get('title') ?? '';
    const subtitle = sp.get('subtitle') ?? '';
    const author   = sp.get('author') ?? '';
    const category = sp.get('category') ?? 'blog';
    const likes    = sp.get('likes') ?? '0';
    const comments = sp.get('comments') ?? '0';
    const section  = sp.get('section');

    const C = CAT[category] ?? CAT.blog;
    const bg = `linear-gradient(160deg, ${C.bg[0]} 0%, ${C.bg[1]} 50%, ${C.bg[2]} 100%)`;

    /* ── 섹션 OG ── */
    if (section) {
      const SEC: Record<string, { title: string; sub: string; kw: string; kwv: string }> = {
        'stock-kr':         { title: '국내 주식 시세',     sub: 'KOSPI · KOSDAQ 실시간 시세 · 종목별 수급 분석', kw: '종목수', kwv: '728+' },
        'stock-us':         { title: '해외 주식 시세',     sub: 'NASDAQ · S&P 500 · 글로벌 주요 종목',         kw: '종목수', kwv: '588+' },
        'stock-heatmap':    { title: '섹터 히트맵',        sub: '업종별 등락률 한눈에 — 반도체·금융·바이오',    kw: '업종수', kwv: '11개' },
        'apt-region':       { title: '전국 부동산 현황',   sub: '지역별 청약·분양·미분양·재개발 현황',          kw: '데이터', kwv: '5,500건+' },
        'apt-calendar':     { title: '청약 캘린더',        sub: '이번 달 접수중·예정 청약 일정 모아보기',        kw: '청약건수', kwv: '10건+' },
        'apt-subscription': { title: '전국 청약 현황',     sub: '접수중 · 예정 · 마감 청약 정보 전체',          kw: '전체',  kwv: '1,000건+' },
      };
      const s = SEC[section] ?? { title: '카더라', sub: '대한민국 소리소문 정보 커뮤니티', kw: '블로그', kwv: '15,500편+' };

      return new ImageResponse(
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505', fontFamily: ff }}>
          {/* 스트라이프 1: 컬러 헤더 */}
          <div style={{ background: C.color, padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogoSVG size={26} />
              <span style={{ fontSize: 20, fontWeight: 900, color: '#000' }}>카더라</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#000', letterSpacing: 1 }}>{C.icon}  {C.label.toUpperCase()}</span>
          </div>
          {/* 스트라이프 2: 수치 */}
          <div style={{ background: '#0D0D0D', padding: '18px 40px', display: 'flex', alignItems: 'center', gap: '5%', flexShrink: 0, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, color: C.color, fontWeight: 700, letterSpacing: 2 }}>{s.kw.toUpperCase()}</span>
              <span style={{ fontSize: 58, fontWeight: 900, color: '#fff', lineHeight: 0.85, letterSpacing: -3 }}>{s.kwv}</span>
            </div>
            <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${C.color}80, transparent)`, borderRadius: 99 }} />
            <span style={{ fontSize: 48 }}>{C.icon}</span>
          </div>
          {/* 스트라이프 3: 제목 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#f9fafb', lineHeight: 1.15, letterSpacing: -1, marginBottom: 10 }}>{s.title}</div>
            <div style={{ fontSize: 16, color: '#374151', lineHeight: 1.55 }}>{s.sub}</div>
          </div>
          {/* 스트라이프 4: 하단 */}
          <div style={{ background: `${C.dim}`, borderTop: `0.5px solid ${C.color}40`, padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>kadeora.app</span>
            <span style={{ fontSize: 12, color: C.color, fontWeight: 700 }}>실시간 업데이트</span>
          </div>
        </div>,
        { width: 1200, height: 630, headers: CACHE, ...opts }
      );
    }

    /* ── 홈 OG ── */
    if (!title) {
      return new ImageResponse(
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505', fontFamily: ff }}>
          {/* 헤더 컬러 띠 */}
          <div style={{ background: '#00FF87', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogoSVG size={28} />
              <span style={{ fontSize: 22, fontWeight: 900, color: '#000' }}>카더라</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(0,0,0,0.5)', letterSpacing: 2 }}>KADEORA.APP</span>
          </div>
          {/* 수치 */}
          <div style={{ background: '#0D0D0D', padding: '16px 40px', display: 'flex', alignItems: 'center', gap: '5%', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#00FF87', fontWeight: 700, letterSpacing: 2 }}>블로그</span>
              <span style={{ fontSize: 54, fontWeight: 900, color: '#fff', lineHeight: 0.85, letterSpacing: -3 }}>15,500편+</span>
            </div>
            <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg,rgba(0,255,135,0.6),transparent)', borderRadius: 99 }} />
            <span style={{ fontSize: 44 }}>📊</span>
          </div>
          {/* 메인 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px' }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: '#f9fafb', lineHeight: 1.15, letterSpacing: -1, marginBottom: 12 }}>아는 사람만 아는 그 정보</div>
            <div style={{ fontSize: 16, color: '#374151' }}>주식 · 청약·분양 · 재테크 · 커뮤니티 · 15,500편+ 블로그</div>
          </div>
          {/* KPI */}
          <div style={{ background: 'rgba(0,255,135,0.08)', borderTop: '0.5px solid rgba(0,255,135,0.2)', padding: '12px 40px', display: 'flex', gap: '6%', flexShrink: 0 }}>
            {[{ n: '728+', l: '주식종목' }, { n: '5,500건+', l: '부동산 데이터' }, { n: '15,500편+', l: '블로그' }, { n: '실시간', l: '업데이트' }].map((k, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#00FF87', lineHeight: 1 }}>{k.n}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: 0.5 }}>{k.l}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', fontWeight: 700 }}>kadeora.app</span>
            </div>
          </div>
        </div>,
        { width: 1200, height: 630, headers: CACHE, ...opts }
      );
    }

    /* ── 포스트 OG — 수평 스트라이프 (1200×630) ──
       안전 영역: 핵심 정보를 좌우 40px 여백 안에 배치
       네이버 PC 3:2 크롭(좌우 128px) → 40px 여백이 내부에 있어 전부 보임
       네이버 모바일 1:1 → og-square 별도 이미지로 대응
    ── */
    const titleTrim  = title.length > 46 ? title.slice(0, 45) + '…' : title;
    const subTrim    = subtitle.length > 60 ? subtitle.slice(0, 59) + '…' : subtitle;
    const hasLikes   = Number(likes) > 0;
    const hasCmts    = Number(comments) > 0;

    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505', fontFamily: ff }}>

        {/* 스트라이프 1: 컬러 헤더 */}
        <div style={{ background: C.color, padding: '12px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoSVG size={24} />
            <span style={{ fontSize: 18, fontWeight: 900, color: '#000' }}>카더라</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#000', letterSpacing: 1 }}>{C.icon}  {C.label.toUpperCase()}</span>
        </div>

        {/* 스트라이프 2: 핵심 수치 (카테고리 컬러 배경) */}
        <div style={{ background: '#0D0D0D', padding: '16px 40px', display: 'flex', alignItems: 'center', gap: '4%', flexShrink: 0, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          {/* 저자 아바타 */}
          {author && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${C.color}, #2563EB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>
                {author[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{author}</span>
            </div>
          )}
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          {hasLikes  && <span style={{ fontSize: 13, color: '#374151' }}>♥ {likes}</span>}
          {hasCmts   && <span style={{ fontSize: 13, color: '#374151' }}>💬 {comments}</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: C.color, padding: '4px 14px', borderRadius: 6, background: C.dim, border: `0.5px solid ${C.color}50` }}>kadeora.app</span>
        </div>

        {/* 스트라이프 3: 제목 메인 (flex:1) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px' }}>
          <div style={{ fontSize: 42, fontWeight: 900, color: '#ffffff', lineHeight: 1.18, letterSpacing: -1.5, marginBottom: subTrim ? 14 : 0, wordBreak: 'keep-all' }}>
            {titleTrim}
          </div>
          {subTrim && (
            <div style={{ fontSize: 18, color: '#6b7280', lineHeight: 1.55, letterSpacing: -0.2 }}>{subTrim}</div>
          )}
        </div>

        {/* 스트라이프 4: KPI 하단 바 */}
        <div style={{ background: C.dim, borderTop: `0.5px solid ${C.color}35`, padding: '11px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FF87', boxShadow: '0 0 6px #00FF87' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 0.5 }}>LIVE  2026</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 900, color: C.color }}>{C.icon}  {C.label}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: 700 }}>kadeora.app</span>
        </div>
      </div>,
      { width: 1200, height: 630, headers: { ...CACHE, 'X-Content-Type-Options': 'nosniff' }, ...opts }
    );

  } catch {
    const cat = new URL(req.url).searchParams.get('category') ?? 'default';
    return Response.redirect(FALLBACK[cat] ?? FALLBACK.default, 302);
  }
}
