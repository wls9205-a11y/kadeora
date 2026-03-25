import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const CATEGORY_COLORS: Record<string, string> = {
  apt: '#2EE8A5',
  stock: '#38BDF8',
  local: '#FFD43B',
  free: '#B794FF',
  finance: '#2EE8A5',
  unsold: '#FFD43B',
  general: '#B794FF',
};

const CATEGORY_LABELS: Record<string, string> = {
  stock: '주식',
  apt: '청약',
  local: '우리동네',
  free: '자유',
  finance: '재테크',
  unsold: '미분양',
  general: '정보',
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

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title');
  const subtitle = searchParams.get('subtitle') ?? '';
  const author = searchParams.get('author') ?? '';
  const category = searchParams.get('category') ?? '';
  const likes = searchParams.get('likes') ?? '0';
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
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
      },
    );
  }

  // Post OG image
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #050A18 0%, #0C1528 50%, #1A2A4A 100%)',
          padding: '56px 64px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Top: logo + category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 72 72">
            <defs><linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0F1B3E" /><stop offset="100%" stopColor="#2563EB" /></linearGradient></defs>
            <rect width="72" height="72" rx="18" fill="url(#lg2)" />
            <circle cx="18" cy="36" r="7" fill="white" /><circle cx="36" cy="36" r="7" fill="white" /><circle cx="54" cy="36" r="7" fill="white" />
          </svg>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#E8EDF5', letterSpacing: '-0.5px' }}>
            카더라
          </span>
          {catLabel && (
            <span style={{
              fontSize: 14, padding: '4px 14px', borderRadius: 999,
              background: `${catColor}22`, color: catColor,
              fontWeight: 700, marginLeft: 8,
            }}>
              {catLabel}
            </span>
          )}
        </div>

        {/* Center: title + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            fontSize: title.length > 50 ? 34 : title.length > 30 ? 40 : 48,
            fontWeight: 800,
            color: '#E8EDF5',
            lineHeight: 1.35,
            maxWidth: 1000,
            overflow: 'hidden',
          }}>
            {title.length > 90 ? title.slice(0, 87) + '...' : title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 22,
              fontWeight: 500,
              color: '#94A8C4',
              lineHeight: 1.4,
            }}>
              {subtitle.length > 80 ? subtitle.slice(0, 77) + '...' : subtitle}
            </div>
          )}
        </div>

        {/* Bottom: author + stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {author && (
              <>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${catColor}, #3B7BF6)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'white',
                }}>
                  {author[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 16, color: '#94A8C4', fontWeight: 500 }}>{author}</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {(Number(likes) > 0 || Number(comments) > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {Number(likes) > 0 && (
                  <span style={{ fontSize: 15, color: '#7D8DA3' }}>♥ {likes}</span>
                )}
                {Number(comments) > 0 && (
                  <span style={{ fontSize: 15, color: '#7D8DA3' }}>💬 {comments}</span>
                )}
              </div>
            )}
            <span style={{ fontSize: 14, color: '#7D8DA3' }}>kadeora.app</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
  } catch {
    const { searchParams } = new URL(req.url);
    const cat = searchParams.get('category') || 'default';
    const fallbackUrl = FALLBACK_IMAGES[cat] || FALLBACK_IMAGES.default;
    return Response.redirect(fallbackUrl, 302);
  }
}
