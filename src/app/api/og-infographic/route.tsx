import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sanitizeForOG } from '@/lib/og-sanitize';
import { brandSurface } from '@/lib/og/brand';

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
  // s270: sanitizeForOG 적용 — 서브셋 외 글자가 satori dynamic font fetch 400 유발
  const title = sanitizeForOG(s.get('title') || '카더라 분석');
  const items = (s.get('items') || '').split(',').filter(Boolean).map(i => {
    const [label, value] = i.split(':');
    return { label: sanitizeForOG(label || ''), value: sanitizeForOG(value || '') };
  });
  const category = s.get('category') || 'stock';

  /**
   * [T1 §3.2·§6.9] 다색 accent 팔레트는 «정보 구분용» 이라 그대로 둔다.
   * bg 필드는 배경이 브랜드 네이비로 통일되면서 쓰이지 않게 돼 뺐다 —
   * 남겨두면 다음 사람이 다시 카테고리별 배경으로 되돌린다(§6.1 금지).
   * apt 의 네온그린만 교체했다. 네이비 위에서 눈을 찌르고, T1 이
   * 전 생성기에서 걷어내기로 한 색이다.
   */
  const catColor: Record<string, { accent: string; label: string }> = {
    stock: { accent: '#00E5FF', label: '주식' },
    apt: { accent: '#34D399', label: '부동산' },
    finance: { accent: '#FFE000', label: '재테크' },
    tax: { accent: '#C084FC', label: '세금' },
    economy: { accent: '#FF6B1A', label: '경제' },
    life: { accent: '#F472B6', label: '생활' },
  };
  const cat = catColor[category] || catColor.stock;

  const fontData = loadFont();
  const fontOpts = fontData ? { fonts: [{ name: 'NK', data: fontData, style: 'normal' as const, weight: 700 as const }] } : {};

  // 인포그래픽 렌더링
  const element = (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
      // [T1 §3.2] 배경만 브랜드 네이비로. 다색 팔레트(accent)는 정보 구분용이라 유지(§6.9).
      ...brandSurface(),
      padding: '48px 56px', fontFamily: 'NK, sans-serif', color: '#fff',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display:'flex', background: cat.accent, color: '#000', padding: '4px 14px', borderRadius: '20px', fontSize: '18px', fontWeight: 700 }}>
          {cat.label}
        </div>
        <div style={{ display:'flex', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>kadeora.app</div>
      </div>

      {/* 제목 */}
      <div style={{ display:'flex', fontSize: '32px', fontWeight: 700, lineHeight: 1.3, marginBottom: '32px', maxWidth: '90%' }}>
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
            <div style={{ display:'flex', fontSize: '18px', color: 'rgba(255,255,255,0.8)' }}>{item.label}</div>
            <div style={{ display:'flex', fontSize: '24px', fontWeight: 700, color: cat.accent }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display:'flex', fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>카더라 — 부동산·주식·재테크 정보</div>
        <div style={{ display:'flex', fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>{new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>
  );

  return new ImageResponse(element, {
    width: 800,
    height: type === 'ranking' ? 1000 : 630,
    ...fontOpts,
  });
}
