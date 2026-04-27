import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CAT: Record<string, { a: string; b: string; label: string; emoji: string }> = {
  apt:     { a: '#00FF87', b: 'rgba(0,255,135,.16)',   label: '청약·분양',  emoji: '🏢' },
  redev:   { a: '#B794FF', b: 'rgba(183,148,255,.16)', label: '재개발',      emoji: '🏗️' },
  unsold:  { a: '#FF6B1A', b: 'rgba(255,107,26,.16)',  label: '미분양',      emoji: '⚠️' },
  stock:   { a: '#00E5FF', b: 'rgba(0,229,255,.16)',   label: '주식·시세',  emoji: '📈' },
  finance: { a: '#FFE000', b: 'rgba(255,224,0,.16)',   label: '재테크',      emoji: '💰' },
  general: { a: '#C084FC', b: 'rgba(192,132,252,.16)', label: '생활정보',    emoji: '📰' },
};

let _fontCache: ArrayBuffer | null = null;
function loadFont(): ArrayBuffer | null {
  if (_fontCache) return _fontCache;
  try {
    const buf = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.woff'));
    _fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _fontCache;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const title = (sp.get('title') ?? '카더라').slice(0, 60);
  const subtitle = (sp.get('subtitle') ?? '').slice(0, 80);
  const category = sp.get('category') ?? 'general';
  const C = CAT[category] ?? CAT.general;
  const fontData = loadFont();
  const fontOpts = fontData
    ? { fonts: [{ name: 'NotoKR', data: fontData, style: 'normal' as const, weight: 700 as const }] }
    : {};
  const ff = fontData ? 'NotoKR, sans-serif' : 'sans-serif';
  const titleFS = title.length > 22 ? 38 : title.length > 16 ? 46 : 54;

  const element = (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#060606', fontFamily: ff }}>
      <div style={{ background: C.a, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 56px', flexShrink: 0 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: '#000' }}>카더라</span>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#000', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 32 }}>{C.emoji}</span>{C.label}
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
        <div style={{ width: 36, height: 4, background: C.a, marginBottom: 28 }} />
        <div style={{ fontSize: titleFS, fontWeight: 900, color: '#fff', lineHeight: 1.18, letterSpacing: -1.5 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 20, color: 'rgba(255,255,255,.55)', marginTop: 22, lineHeight: 1.55 }}>{subtitle}</div>}
      </div>
      <div style={{ background: C.b, borderTop: `1px solid ${C.a}40`, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 56px', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.a }}>{C.emoji} {C.label}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>kadeora.app</span>
      </div>
    </div>
  );

  try {
    const img = new ImageResponse(element, {
      width: 1200,
      height: 630,
      emoji: 'twemoji',
      ...fontOpts,
    });
    return new Response(await img.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch {
    return Response.redirect('https://kadeora.app/images/brand/kadeora-hero.png', 302);
  }
}
