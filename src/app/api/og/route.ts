import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? '카더라'
  const category = searchParams.get('category') ?? ''
  const author = searchParams.get('author') ?? ''
  const likes = searchParams.get('likes') ?? '0'

  const CATEGORY_LABELS: Record<string, string> = {
    local: '📍 지역', stock: '📈 주식', housing: '🏠 청약', free: '💬 자유', hot: '🔥 핫',
  }
  const categoryLabel = CATEGORY_LABELS[category] ?? category

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #0F0F0F 0%, #1A0A08 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 원 장식 */}
        <div style={{
          position: 'absolute', top: '-100px', right: '-100px',
          width: '400px', height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,75,54,0.15) 0%, transparent 70%)',
        }} />

        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '36px', fontWeight: 900, color: '#FF4B36', letterSpacing: '-2px' }}>
            카더라
          </span>
          {categoryLabel && (
            <span style={{
              fontSize: '16px', color: '#FF4B36',
              background: 'rgba(255,75,54,0.15)',
              padding: '6px 14px', borderRadius: '20px',
              border: '1px solid rgba(255,75,54,0.3)',
            }}>
              {categoryLabel}
            </span>
          )}
        </div>

        {/* 제목 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <h1 style={{
            fontSize: title.length > 30 ? '44px' : '56px',
            fontWeight: 800,
            color: '#F5F5F5',
            lineHeight: 1.3,
            maxWidth: '900px',
            wordBreak: 'keep-all',
          }}>
            {title.length > 60 ? title.slice(0, 60) + '...' : title}
          </h1>
        </div>

        {/* 푸터 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '18px' }}>
            {author && <span>✍️ {author}</span>}
            {parseInt(likes) > 0 && <span>❤️ {parseInt(likes).toLocaleString()}</span>}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px' }}>kadeora.com</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
