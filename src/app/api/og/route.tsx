import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const CATEGORY_COLORS: Record<string, string> = {
  apt: '#34D399',
  stock: '#38BDF8',
  local: '#FBBF24',
  free: '#A78BFA',
  finance: '#34D399',
  unsold: '#FBBF24',
  general: '#A78BFA',
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

const FALLBACK_IMAGES: Record<string, string> = {
  stock: 'https://kadeora.app/images/brand/kadeora-wide.png',
  finance: 'https://kadeora.app/images/brand/kadeora-hero.png',
  apt: 'https://kadeora.app/images/brand/kadeora-full.png',
  unsold: 'https://kadeora.app/images/brand/kadeora-full.png',
  blog: 'https://kadeora.app/images/brand/kadeora-wide.png',
  default: 'https://kadeora.app/images/brand/kadeora-hero.png',
};

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title');
  const author = searchParams.get('author') ?? '';
  const category = searchParams.get('category') ?? '';
  const likes = searchParams.get('likes') ?? '0';
  const comments = searchParams.get('comments') ?? '0';

  const catColor = CATEGORY_COLORS[category] ?? '#A78BFA';
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
            background: 'linear-gradient(135deg, #0B1426 0%, #0F1D35 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12, background: '#FB923C',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 900, color: '#fff',
            }}>K</div>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#E2E8F0', letterSpacing: '-1px' }}>
              카더라
            </span>
          </div>
          <div style={{ fontSize: 24, color: '#94a3b8', fontWeight: 500, marginBottom: 16 }}>
            아는 사람만 아는 그 정보
          </div>
          <div style={{ fontSize: 16, color: '#64748B', fontWeight: 400 }}>
            주식 · 부동산 · 청약 · 우리동네
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
          background: 'linear-gradient(135deg, #0B1426 0%, #0F1D35 100%)',
          padding: '56px 64px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Top: logo + category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#FB923C',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, color: '#fff',
          }}>K</div>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#E2E8F0', letterSpacing: '-0.5px' }}>
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

        {/* Center: title */}
        <div style={{
          fontSize: title.length > 50 ? 34 : title.length > 30 ? 40 : 48,
          fontWeight: 800,
          color: '#E2E8F0',
          lineHeight: 1.35,
          maxWidth: 1000,
          display: '-webkit-box',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {title.length > 90 ? title.slice(0, 87) + '...' : title}
        </div>

        {/* Bottom: author + stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {author && (
              <>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${catColor}, #FB923C)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'white',
                }}>
                  {author[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 500 }}>{author}</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {(Number(likes) > 0 || Number(comments) > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {Number(likes) > 0 && (
                  <span style={{ fontSize: 15, color: '#64748b' }}>♥ {likes}</span>
                )}
                {Number(comments) > 0 && (
                  <span style={{ fontSize: 15, color: '#64748b' }}>💬 {comments}</span>
                )}
              </div>
            )}
            <span style={{ fontSize: 14, color: '#64748B' }}>kadeora.app</span>
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
