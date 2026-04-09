import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

let _fontCache: ArrayBuffer | null = null;
function loadFont(): ArrayBuffer | null {
  if (_fontCache) return _fontCache;
  try {
    const buf = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.woff'));
    _fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _fontCache;
  } catch { return null; }
}

/**
 * 인포그래픽 이미지 동적 생성 API
 * GET /api/og-infographic?type=price_change&title=제목&items=항목1:값1,항목2:값2&category=stock
 *
 * 유형: price_change | ranking | comparison | timeline | calculator | summary
 */
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams;
  const type = s.get('type') || 'summary';
  const title = s.get('title') || '카더라 분석';
  const items = (s.get('items') || '').split(',').filter(Boolean).map(i => {
    const [label, value] = i.split(':');
    return { label: label || '', value: value || '' };
  });
  const category = s.get('category') || 'stock';

  const catColor: Record<string, { bg: string; accent: string; label: string }> = {
    stock: { bg: '#051830', accent: '#00E5FF', label: '주식' },
    apt: { bg: '#031509', accent: '#00FF87', label: '부동산' },
    finance: { bg: '#140E00', accent: '#FFE000', label: '재테크' },
    tax: { bg: '#0D0825', accent: '#C084FC', label: '세금' },
    economy: { bg: '#070500', accent: '#FF6B1A', label: '경제' },
    life: { bg: '#080210', accent: '#F472B6', label: '생활' },
  };
  const cat = catColor[category] || catColor.stock;

  const fontData = loadFont();
  const fontOpts = fontData ? { fonts: [{ name: 'NK', data: fontData, style: 'normal' as const, weight: 700 as const }] } : {};

  // 인포그래픽 렌더링
  const element = (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
      background: `linear-gradient(160deg, ${cat.bg} 0%, #000 100%)`,
      padding: '48px 56px', fontFamily: 'NK, sans-serif', color: '#fff',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: cat.accent, color: '#000', padding: '4px 14px', borderRadius: '20px', fontSize: '18px', fontWeight: 700 }}>
          {cat.label}
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>kadeora.app</div>
      </div>

      {/* 제목 */}
      <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1.3, marginBottom: '32px', maxWidth: '90%' }}>
        {title.slice(0, 50)}
      </div>

      {/* 데이터 항목 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
        {items.slice(0, 5).map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 24px',
            borderLeft: `3px solid ${cat.accent}`,
          }}>
            <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.8)' }}>{item.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: cat.accent }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>카더라 — 부동산·주식·재테크 정보</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>{new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>
  );

  return new ImageResponse(element, {
    width: 800,
    height: type === 'ranking' ? 1000 : 630,
    ...fontOpts,
  });
}
