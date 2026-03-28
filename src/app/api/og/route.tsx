import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const CAT: Record<string, { color: string; dim: string; bg: [string,string,string]; label: string; icon: string }> = {
  apt:     { color: '#00E87A', dim: 'rgba(0,232,122,0.15)',   bg: ['#020E06','#041A0B','#072412'], label: '청약·분양',   icon: '🏢' },
  stock:   { color: '#00D4FF', dim: 'rgba(0,212,255,0.15)',   bg: ['#020810','#041525','#071E38'], label: '주식·시세',   icon: '📈' },
  finance: { color: '#FFD100', dim: 'rgba(255,209,0,0.15)',   bg: ['#080600','#160F00','#221600'], label: '재테크·절세', icon: '💰' },
  unsold:  { color: '#FF6200', dim: 'rgba(255,98,0,0.15)',    bg: ['#080200','#180700','#260F00'], label: '미분양',      icon: '⚠️' },
  general: { color: '#B47FFF', dim: 'rgba(180,127,255,0.15)', bg: ['#04020F','#0A0825','#100E38'], label: '생활정보',   icon: '📰' },
  blog:    { color: '#B47FFF', dim: 'rgba(180,127,255,0.15)', bg: ['#04020F','#0A0825','#100E38'], label: '블로그',      icon: '✍️' },
  local:   { color: '#FFD43B', dim: 'rgba(255,212,59,0.15)',  bg: ['#080700','#141000','#201800'], label: '우리동네',   icon: '📍' },
  free:    { color: '#F472B6', dim: 'rgba(244,114,182,0.15)', bg: ['#080210','#130820','#1E0F30'], label: '자유',        icon: '💬' },
};

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://kadeora.app';

let cachedFont: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer | null> {
  if (cachedFont) return cachedFont;
  try {
    const res = await fetch(`${SITE}/fonts/NotoSansKR-Bold.woff`);
    if (res.ok) { cachedFont = await res.arrayBuffer(); return cachedFont; }
  } catch { /* ignore */ }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const fontData = await loadFont();
    const fonts = fontData ? [{ name: 'NK', data: fontData, style: 'normal' as const, weight: 700 as const }] : [];
    const ff = fontData ? 'NK, sans-serif' : 'sans-serif';
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

    // ── 로고 컴포넌트 ──
    const LogoSVG = (size: number) => (
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 섹션 OG (주식·부동산 탭 페이지)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (section) {
      const SEC: Record<string, { title: string; sub: string; chips: string[] }> = {
        'stock-kr':         { title: '국내 주식 시세',    sub: 'KOSPI · KOSDAQ 실시간 시세 · 종목별 수급 분석',     chips: ['삼성전자', 'SK하이닉스', 'POSCO'] },
        'stock-us':         { title: '해외 주식 시세',    sub: 'NASDAQ · S&P 500 · 글로벌 주요 종목 시세',         chips: ['Apple', 'NVIDIA', 'Microsoft'] },
        'stock-heatmap':    { title: '섹터 히트맵',       sub: '업종별 등락률 한눈에 — 반도체·금융·바이오·IT',     chips: ['반도체', '금융', '바이오'] },
        'apt-region':       { title: '전국 부동산 현황',  sub: '지역별 청약·분양·미분양·재개발 실시간 현황',       chips: ['경기 625건', '서울 160건', '부산 150건'] },
        'apt-calendar':     { title: '청약 캘린더',       sub: '이번 달 접수중·예정 청약 일정 모아보기',           chips: ['접수중 3건', '예정 7건'] },
        'apt-subscription': { title: '전국 청약 현황',    sub: '접수중 · 예정 · 마감 청약 정보 전체',             chips: ['전체 1,000건+'] },
      };
      const s = SEC[section] ?? { title: '카더라', sub: '대한민국 소리소문 정보 커뮤니티', chips: [] };

      return new ImageResponse(
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: bg, fontFamily: ff, padding: '48px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {LogoSVG(38)}
            <span style={{ fontSize: 22, fontWeight: 700, color: '#CBD5E1', marginLeft: 2 }}>카더라</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 15, color: C.color, fontWeight: 700, padding: '6px 18px', borderRadius: 8, background: C.dim, border: `1px solid ${C.color}50` }}>
              {C.icon}  {C.label}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 54, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-2px', lineHeight: 1.05 }}>{s.title}</div>
            <div style={{ fontSize: 20, color: '#64748B', fontWeight: 500 }}>{s.sub}</div>
            {s.chips.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {s.chips.map((ch, i) => (
                  <span key={i} style={{ fontSize: 16, fontWeight: 700, color: C.color, padding: '7px 18px', borderRadius: 8, background: C.dim, border: `1px solid ${C.color}40` }}>{ch}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
            <span style={{ fontSize: 14, color: '#334155', fontWeight: 700 }}>kadeora.app</span>
            <span style={{ fontSize: 13, color: '#1E293B' }}>실시간 업데이트</span>
          </div>
        </div>,
        { width: 1200, height: 630, headers: CACHE, fonts }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 홈 OG
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!title) {
      return new ImageResponse(
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#020810 0%,#050F1E 50%,#0A1830 100%)', fontFamily: ff }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            {LogoSVG(64)}
            <span style={{ fontSize: 62, fontWeight: 900, color: '#F1F5F9', letterSpacing: '-2px' }}>카더라</span>
          </div>
          <div style={{ fontSize: 26, color: '#93C5FD', fontWeight: 700, marginBottom: 36 }}>아는 사람만 아는 그 정보</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {([['📈','주식·시세','#00D4FF'],['🏢','청약·분양','#00E87A'],['💰','재테크','#FFD100'],['💬','커뮤니티','#F472B6']] as const).map(([ic, lb, cl], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <span style={{ fontSize: 22 }}>{ic}</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: cl }}>{lb}</span>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: 36, fontSize: 14, color: '#1E293B', fontWeight: 700 }}>kadeora.app</div>
        </div>,
        { width: 1200, height: 630, headers: CACHE, fonts }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 포스트·블로그 OG
    //
    //  구조 (1200 × 630):
    //  ┌────────────────────────────────────────────────────────┐
    //  │  [로고]  카더라                     [🏢 청약·분양 뱃지] │ 72px
    //  ├────────────────────────────────────────────────────────┤
    //  │                                                        │
    //  │  🏢  청약·분양 ─────────────────────────────           │
    //  │                                                        │
    //  │  강남구 개포동 신규 분양                                 │
    //  │  청약 일정 분석 (52px / 900)                           │
    //  │                                                        │
    //  │  2026년 상반기 주요 청약 현황... (19px / #94A3B8)      │
    //  │                                                        │
    //  ├────────────────────────────────────────────────────────┤
    //  │  카더라 데이터팀          ♥24  💬8  [kadeora.app]     │ 58px
    //  └────────────────────────────────────────────────────────┘
    //
    //  네이버 뷰탭 크롭 대응:
    //  - 전체 padding 56px → 핵심 콘텐츠가 중앙에 집중
    //  - 카테고리 라벨이 헤더+메인 두 곳에 노출 (크롭 시 둘 중 하나는 반드시 보임)
    //  - 제목 최대 52자 (2줄) → 1:1 크롭에도 잘림 없음
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const titleTrim  = title.length > 52 ? title.slice(0, 51) + '…' : title;
    const subTrim    = subtitle.length > 72 ? subtitle.slice(0, 71) + '…' : subtitle;
    const titleFS    = title.length > 36 ? 40 : title.length > 22 ? 46 : 52;
    const hasLikes   = Number(likes) > 0;
    const hasCmts    = Number(comments) > 0;

    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: bg, fontFamily: ff, position: 'relative', overflow: 'hidden' }}>

        {/* 배경 글로우 */}
        <div style={{ position: 'absolute', top: -140, right: -140, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${C.dim} 0%, transparent 65%)`, display: 'flex' }} />

        {/* ── 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 56px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, height: 72 }}>
          {LogoSVG(32)}
          <span style={{ fontSize: 20, fontWeight: 700, color: '#CBD5E1', marginLeft: 10, letterSpacing: '-0.3px' }}>카더라</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: C.color, padding: '6px 20px', borderRadius: 8, background: C.dim, border: `1px solid ${C.color}50` }}>
            {C.icon}  {C.label}
          </span>
        </div>

        {/* ── 메인 ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>

          {/* 카테고리 대형 라벨 (주제 즉시 인식) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <span style={{ fontSize: 32, lineHeight: 1 }}>{C.icon}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: C.color, letterSpacing: '2px' }}>
              {C.label.toUpperCase()}
            </span>
            <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${C.color}70, transparent)`, borderRadius: 99 }} />
          </div>

          {/* 제목 */}
          <div style={{ fontSize: titleFS, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2, letterSpacing: '-1.5px', wordBreak: 'keep-all', maxWidth: 1088 }}>
            {titleTrim}
          </div>

          {/* 부제 */}
          {subTrim && (
            <div style={{ fontSize: 19, fontWeight: 500, color: '#94A3B8', lineHeight: 1.55, marginTop: 20, maxWidth: 900, letterSpacing: '-0.2px' }}>
              {subTrim}
            </div>
          )}
        </div>

        {/* ── 하단 ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 56px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, height: 58 }}>
          {/* 저자 */}
          {author ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${C.color}, #3B7BF6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>
                {author[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>{author}</span>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>카더라 데이터팀</span>
          )}
          <div style={{ flex: 1 }} />
          {hasLikes  && <span style={{ fontSize: 14, color: '#475569', marginRight: 12 }}>♥ {likes}</span>}
          {hasCmts   && <span style={{ fontSize: 14, color: '#475569', marginRight: 16 }}>💬 {comments}</span>}
          <span style={{ fontSize: 14, fontWeight: 700, color: C.color, padding: '5px 16px', borderRadius: 7, background: C.dim, border: `1px solid ${C.color}40` }}>kadeora.app</span>
        </div>

      </div>,
      { width: 1200, height: 630, headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800', 'X-Content-Type-Options': 'nosniff' }, fonts }
    );

  } catch {
    const cat = new URL(req.url).searchParams.get('category') ?? 'default';
    const fb: Record<string,string> = { stock:`${SITE}/images/brand/kadeora-wide.png`, apt:`${SITE}/images/brand/kadeora-full.png`, default:`${SITE}/images/brand/kadeora-hero.png` };
    return Response.redirect(fb[cat] ?? fb.default, 302);
  }
}
