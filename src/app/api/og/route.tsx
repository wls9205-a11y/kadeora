import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const CATEGORY_COLORS: Record<string, string> = {
  apt: '#2EE8A5',
  stock: '#38BDF8',
  local: '#FFD43B',
  free: '#B794FF',
  finance: '#F59E0B',
  unsold: '#FB923C',
  general: '#A78BFA',
  blog: '#60A5FA',
};

const CATEGORY_LABELS: Record<string, string> = {
  stock: '주식',
  apt: '청약·분양',
  local: '우리동네',
  free: '자유',
  finance: '재테크',
  unsold: '미분양',
  general: '생활정보',
  blog: '블로그',
};

// 카테고리별 이모지 아이콘
const CATEGORY_ICONS: Record<string, string> = {
  apt: '🏢',
  stock: '📈',
  finance: '💰',
  unsold: '🏚️',
  general: '📰',
  blog: '✍️',
  local: '📍',
  free: '💬',
};

// 카테고리별 그라디언트 배경 (어두운 계열)
const CATEGORY_BG: Record<string, string> = {
  apt:     'linear-gradient(135deg, #050A18 0%, #0A1F10 50%, #0F2D18 100%)',
  stock:   'linear-gradient(135deg, #050A18 0%, #071828 50%, #0C2040 100%)',
  finance: 'linear-gradient(135deg, #050A18 0%, #1A1005 50%, #2A1A00 100%)',
  unsold:  'linear-gradient(135deg, #050A18 0%, #1A0E05 50%, #2A1500 100%)',
  general: 'linear-gradient(135deg, #050A18 0%, #100A2A 50%, #1A0F40 100%)',
  blog:    'linear-gradient(135deg, #050A18 0%, #071828 50%, #0C2040 100%)',
};

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://kadeora.app';

const FALLBACK_IMAGES: Record<string, string> = {
  stock: `${SITE}/images/brand/kadeora-wide.png`,
  finance: `${SITE}/images/brand/kadeora-hero.png`,
  apt: `${SITE}/images/brand/kadeora-full.png`,
  unsold: `${SITE}/images/brand/kadeora-full.png`,
  blog: `${SITE}/images/brand/kadeora-wide.png`,
  default: `${SITE}/images/brand/kadeora-hero.png`,
};

// Noto Sans KR Bold WOFF — public/fonts에서 로드 (Edge Runtime 호환)
// woff(1)은 satori/Vercel Edge 지원. woff2/otf/ttf는 미지원.
let cachedFont: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer | null> {
  if (cachedFont) return cachedFont;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://kadeora.app';
    const res = await fetch(`${base}/fonts/NotoSansKR-Bold.woff`);
    if (res.ok) {
      cachedFont = await res.arrayBuffer();
      return cachedFont;
    }
  } catch { /* ignore */ }
  return null;
}

export async function GET(req: NextRequest) {
  try {
  const fontData = await loadFont();
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title');
  const subtitle = searchParams.get('subtitle') ?? '';
  const author = searchParams.get('author') ?? '';
  const category = searchParams.get('category') ?? '';
  const likes = searchParams.get('likes') ?? '0';
  const section = searchParams.get('section');

  // ━━━ 섹션별 OG 이미지 ━━━
  if (section) {
    const SEC: Record<string, { title: string; desc: string; emoji: string; color: string; stats: string[] }> = {
      'stock-kr':      { title: '국내 주식 시세', desc: 'KOSPI · KOSDAQ 실시간 시세', emoji: '📊', color: '#38BDF8', stats: ['삼성전자', 'SK하이닉스', 'LG에너지솔루션'] },
      'stock-us':      { title: '해외 주식 시세', desc: 'NASDAQ · S&P 500 글로벌 시세', emoji: '🌍', color: '#2EE8A5', stats: ['Apple', 'Microsoft', 'NVIDIA'] },
      'stock-heatmap': { title: '섹터별 등락률 히트맵', desc: '업종별 시장 흐름을 한눈에', emoji: '🗺️', color: '#A78BFA', stats: ['반도체', '금융', '바이오', 'IT'] },
      'apt-region':    { title: '전국 부동산 현황', desc: '지역별 청약·분양·미분양·재개발', emoji: '🏢', color: '#2EE8A5', stats: ['경기 625', '서울 160', '부산 150'] },
      'apt-calendar':  { title: '이번 달 청약 캘린더', desc: '접수중·예정 청약 일정 모아보기', emoji: '📅', color: '#FFD43B', stats: ['접수중 3건', '예정 7건'] },
      'apt-subscription': { title: '전국 청약 현황', desc: '접수중·예정·마감 청약 정보', emoji: '🏗️', color: '#38BDF8', stats: ['전체 1,000건'] },
    };
    const s = SEC[section] || { title: '카더라', desc: '대한민국 소리소문 정보', emoji: '📡', color: '#38BDF8', stats: [] };

    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #050A18 0%, #0C1528 50%, #1A2A4A 100%)', fontFamily: 'NotoSansKR, sans-serif', padding: '48px 56px' }}>
          {/* 상단: 로고 + 섹션 라벨 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <svg width="36" height="36" viewBox="0 0 72 72"><defs><linearGradient id="slg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0F1B3E" /><stop offset="100%" stopColor="#2563EB" /></linearGradient></defs><rect width="72" height="72" rx="18" fill="url(#slg)" /><circle cx="18" cy="36" r="7" fill="white" /><circle cx="36" cy="36" r="7" fill="white" /><circle cx="54" cy="36" r="7" fill="white" /></svg>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#93C5FD', letterSpacing: '-0.5px' }}>카더라</span>
          </div>

          {/* 중앙: 메인 콘텐츠 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>{s.emoji}</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#E8EDF5', lineHeight: 1.2, marginBottom: 12, letterSpacing: '-1px' }}>
              {s.title}
            </div>
            <div style={{ fontSize: 22, color: '#94A8C4', fontWeight: 500, marginBottom: 28 }}>
              {s.desc}
            </div>

            {/* 통계 칩 */}
            {s.stats.length > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                {s.stats.map((st, i) => (
                  <div key={i} style={{ padding: '8px 18px', borderRadius: 12, background: `${s.color}18`, border: `1px solid ${s.color}33`, color: s.color, fontSize: 17, fontWeight: 700 }}>
                    {st}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 하단: URL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, color: '#64748B' }}>kadeora.app</span>
            <span style={{ fontSize: 14, color: '#475569', padding: '4px 12px', borderRadius: 8, background: '#ffffff0a', border: '1px solid #ffffff12' }}>실시간 업데이트</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630, ...(fontData ? { fonts: [{ name: 'NotoSansKR', data: fontData, style: 'normal' as const, weight: 700 as const }] } : {}) }
    );
  }
  const comments = searchParams.get('comments') ?? '0';

  const catColor = CATEGORY_COLORS[category] ?? '#B794FF';
  const catLabel = CATEGORY_LABELS[category] ?? '';

  // Home OG image (no title param)
  if (!title) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #050A18 0%, #0C1528 50%, #1A2A4A 100%)',
            fontFamily: 'NotoSansKR, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <svg width="56" height="56" viewBox="0 0 72 72">
              <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0F1B3E" /><stop offset="100%" stopColor="#2563EB" /></linearGradient></defs>
              <rect width="72" height="72" rx="18" fill="url(#lg)" />
              <circle cx="18" cy="36" r="7" fill="white" /><circle cx="36" cy="36" r="7" fill="white" /><circle cx="54" cy="36" r="7" fill="white" />
            </svg>
            <span style={{ fontSize: 52, fontWeight: 900, color: '#E8EDF5', letterSpacing: '-1px' }}>
              카더라
            </span>
          </div>
          <div style={{ fontSize: 26, color: '#93C5FD', fontWeight: 600, marginBottom: 14 }}>
            아는 사람만 아는 그 정보
          </div>
          <div style={{ fontSize: 18, color: '#64748B', fontWeight: 400, display: 'flex', gap: 16 }}>
            <span>📊 주식</span><span>🏢 부동산</span><span>📝 커뮤니티</span><span>🗳️ 토론</span>
          </div>
          <div style={{ position: 'absolute', bottom: 32, fontSize: 14, color: '#475569' }}>
            kadeora.app
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
        ...(fontData ? { fonts: [{ name: 'NotoSansKR', data: fontData, style: 'normal' as const, weight: 700 as const }] } : {}),
      },
    );
  }

  // Post OG image — 네이버 VIEW탭 최적화
  const catIcon = CATEGORY_ICONS[category] ?? '✍️';
  const catBg = CATEGORY_BG[category] ?? 'linear-gradient(135deg, #050A18 0%, #0C1528 50%, #1A2A4A 100%)';

  // 제목 길이에 따른 폰트 크기 조정
  const titleLen = title.length;
  const titleFontSize = titleLen > 60 ? 32 : titleLen > 40 ? 38 : titleLen > 25 ? 44 : 52;
  const titleDisplay = titleLen > 80 ? title.slice(0, 77) + '...' : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: catBg,
          padding: '48px 60px',
          fontFamily: 'NotoSansKR, sans-serif',
          position: 'relative',
        }}
      >
        {/* 배경 장식 원 */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 320, height: 320, borderRadius: '50%',
          background: `radial-gradient(circle, ${catColor}18 0%, transparent 70%)`,
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: `radial-gradient(circle, ${catColor}10 0%, transparent 70%)`,
          display: 'flex',
        }} />

        {/* Top: 로고 + 카테고리 뱃지 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="36" height="36" viewBox="0 0 72 72">
              <defs><linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0F1B3E" /><stop offset="100%" stopColor="#2563EB" /></linearGradient></defs>
              <rect width="72" height="72" rx="18" fill="url(#lg2)" />
              <circle cx="18" cy="36" r="7" fill="white" /><circle cx="36" cy="36" r="7" fill="white" /><circle cx="54" cy="36" r="7" fill="white" />
            </svg>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#E8EDF5', letterSpacing: '-0.5px' }}>
              카더라
            </span>
          </div>
          {catLabel && (
            <span style={{
              fontSize: 15, padding: '6px 18px', borderRadius: 999,
              background: `${catColor}25`,
              border: `1.5px solid ${catColor}50`,
              color: catColor,
              fontWeight: 700,
            }}>
              {catIcon} {catLabel}
            </span>
          )}
        </div>

        {/* Center: 아이콘 + 제목 + 부제 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'center', padding: '24px 0' }}>
          {/* 카테고리 아이콘 (큰 것) */}
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 4 }}>{catIcon}</div>

          {/* 제목 */}
          <div style={{
            fontSize: titleFontSize,
            fontWeight: 800,
            color: '#F1F5F9',
            lineHeight: 1.3,
            maxWidth: 1040,
            wordBreak: 'keep-all',
            letterSpacing: titleLen > 40 ? '-0.5px' : '-1px',
          }}>
            {titleDisplay}
          </div>

          {/* 부제 */}
          {subtitle && (
            <div style={{
              fontSize: 20,
              fontWeight: 500,
              color: '#94A8C4',
              lineHeight: 1.5,
              maxWidth: 900,
            }}>
              {subtitle.length > 90 ? subtitle.slice(0, 87) + '...' : subtitle}
            </div>
          )}
        </div>

        {/* Bottom: 저자 + 사이트 URL + 구분선 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: `1px solid ${catColor}30`, paddingTop: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {author ? (
              <>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${catColor}, #3B7BF6)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: 'white',
                }}>
                  {author[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 15, color: '#94A8C4', fontWeight: 600 }}>{author}</span>
              </>
            ) : (
              <span style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}>카더라 데이터팀</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {Number(likes) > 0 && <span style={{ fontSize: 14, color: '#64748B' }}>♥ {likes}</span>}
            {Number(comments) > 0 && <span style={{ fontSize: 14, color: '#64748B' }}>💬 {comments}</span>}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 8,
              background: `${catColor}15`, border: `1px solid ${catColor}30`,
            }}>
              <span style={{ fontSize: 13, color: catColor, fontWeight: 700 }}>kadeora.app</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
      ...(fontData ? { fonts: [{ name: 'NotoSansKR', data: fontData, style: 'normal' as const, weight: 700 as const }] } : {}),
    },
  );
  } catch {
    const { searchParams } = new URL(req.url);
    const cat = searchParams.get('category') || 'default';
    const fallbackUrl = FALLBACK_IMAGES[cat] || FALLBACK_IMAGES.default;
    return Response.redirect(fallbackUrl, 302);
  }
}
