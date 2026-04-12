import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * 이미지 프록시 — 외부 이미지에 카더라 워터마크 베이킹
 * 
 * Usage: /api/apt-img?src=https://external.com/image.jpg
 * - 외부 이미지를 다운로드 → 워터마크 합성 → PNG 반환
 * - Vercel CDN 7일 캐싱 (동일 URL 재처리 방지)
 * - referrer 없이 가져오기 (핫링크 방지 우회)
 */
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src');
  if (!src) {
    return new Response('Missing src parameter', { status: 400 });
  }

  try {
    // 외부 이미지 유효성 확인 (HEAD 요청)
    const decoded = decodeURIComponent(src);

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            position: 'relative',
            background: '#0c1629',
          }}
        >
          {/* 외부 이미지 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={decoded}
            width={800}
            height={450}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* 중앙 반투명 워터마크 로고 */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.35,
            }}
          >
            <svg width="100" height="100" viewBox="0 0 72 72">
              <rect width="72" height="72" rx="18" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              <circle cx="18" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
              <circle cx="36" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
              <circle cx="54" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
            </svg>
          </div>

          {/* 우하단 텍스트 워터마크 */}
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              right: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: 0.6,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 72 72">
              <circle cx="18" cy="36" r="7" fill="rgba(255,255,255,0.8)" />
              <circle cx="36" cy="36" r="7" fill="rgba(255,255,255,0.8)" />
              <circle cx="54" cy="36" r="7" fill="rgba(255,255,255,0.8)" />
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
              kadeora.app
            </span>
          </div>
        </div>
      ),
      {
        width: 800,
        height: 450,
        headers: {
          'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400',
        },
      }
    );
  } catch {
    return new Response('Image processing failed', { status: 500 });
  }
}
