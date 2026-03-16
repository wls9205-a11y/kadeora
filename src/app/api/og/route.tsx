import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const SITE_NAME = '카더라';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.vercel.app';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? '카더라 — 당신이 몰랐던 진짜 정보';
  const author = searchParams.get('author') ?? '';
  const category = searchParams.get('category') ?? '';

  const CATEGORY_LABELS: Record<string, string> = {
    stock: '📈 주식',
    apt: '🏠 청약',
    discuss: '💬 토론',
    free: '💬 자유',
  };
  const categoryLabel = CATEGORY_LABELS[category] ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0A0E17',
          padding: '60px 64px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#3B82F6', letterSpacing: '-1px' }}>
            KADEORA
          </span>
          {categoryLabel && (
            <span style={{
              fontSize: 14, padding: '4px 12px', borderRadius: 999,
              background: 'rgba(59,130,246,0.15)', color: '#60A5FA',
              fontWeight: 700, marginLeft: 8,
            }}>
              {categoryLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{
          fontSize: title.length > 40 ? 36 : 44,
          fontWeight: 800,
          color: '#F1F5F9',
          lineHeight: 1.3,
          maxWidth: 900,
          display: '-webkit-box',
        }}>
          {title}
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {author && (
              <>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'white',
                }}>
                  {author[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 16, color: '#94A3B8', fontWeight: 500 }}>{author}</span>
              </>
            )}
          </div>
          <span style={{ fontSize: 14, color: '#475569' }}>{SITE_URL}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}