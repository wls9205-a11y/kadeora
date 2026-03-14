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
    local: '지역', stock: '주식', housing: '청약', free: '자유', hot: '핫',
  }
  const categoryLabel = CATEGORY_LABELS[category] ?? category
  const displayTitle = title.length > 60 ? title.slice(0, 60) + '...' : title
  const fontSize = title.length > 30 ? '44px' : '56px'

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: { width: '1200px', height: '630px', background: 'linear-gradient(135deg, #0F0F0F 0%, #1A0A08 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px', fontFamily: 'sans-serif' },
        children: [
          { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [
            { type: 'span', props: { style: { fontSize: '36px', fontWeight: 900, color: '#FF4B36' }, children: '카더라' } },
            categoryLabel ? { type: 'span', props: { style: { fontSize: '16px', color: '#FF4B36', background: 'rgba(255,75,54,0.15)', padding: '6px 14px', borderRadius: '20px' }, children: categoryLabel } } : null,
          ]}},
          { type: 'div', props: { style: { flex: 1, display: 'flex', alignItems: 'center' }, children:
            { type: 'h1', props: { style: { fontSize, fontWeight: 800, color: '#F5F5F5', lineHeight: 1.3, maxWidth: '900px' }, children: displayTitle } }
          }},
          { type: 'div', props: { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [
            { type: 'div', props: { style: { display: 'flex', gap: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '18px' }, children: [
              author ? { type: 'span', props: { children: author } } : null,
              parseInt(likes) > 0 ? { type: 'span', props: { children: likes + ' likes' } } : null,
            ]}},
            { type: 'span', props: { style: { color: 'rgba(255,255,255,0.2)', fontSize: '16px' }, children: 'kadeora.com' } },
          ]}},
        ],
      },
    },
    { width: 1200, height: 630 }
  )
}
