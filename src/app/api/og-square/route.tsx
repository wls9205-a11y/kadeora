import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { OG_CAT as CAT } from '@/lib/og-tokens';
import { sanitizeForOG } from '@/lib/og-sanitize';
import { SITE_URL as SITE } from '@/lib/constants';
import { barColor, titleLines, BRAND_BG_SOLID, GOLD } from '@/lib/og/brand';
import { BrandCard } from '@/lib/og/frame';

export const runtime = 'nodejs';
export const maxDuration = 30;

// og-square: 630×630 — 네이버 모바일 1:1 크롭 전용.
// T1 §3.1: 확정 규격(A안) 적용. 검색결과에서 ~120px 로 축소돼 뜨므로 제목이
// 프레임을 채워야 한다. 기존 레이아웃(컬러 헤더 + 로고 + 카테고리 통계 KPI)은
// 전부 걷어냈다 — 축소되면 로고·통계는 읽히지도 않으면서 제목 자리만 먹었다.

const SIDE = 630;

/* ── 폰트: Node.js fs.readFileSync — 100% 확실 ── */
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
  try {
    const fontData = loadFont();
    const ff = fontData ? 'NK, sans-serif' : 'sans-serif';
    const opts = fontData ? { fonts: [{ name: 'NK', data: fontData, style: 'normal' as const, weight: 700 as const }] } : {};
    const CACHE = {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
    };

    const sp = new URL(req.url).searchParams;
    const category = sp.get('category') ?? 'blog';
    // ⚠️ 원문을 sanitizeForOG 로 먼저 씻지 말 것 — em dash 가 '-' 로 바뀌면서 §2 절단이
    //    안 먹는다('-' 는 범천1-1 때문에 절단 문자에서 일부러 빠져 있다).
    //    원문 → titleLines → 줄 단위 sanitize 순서다.
    const raw = sp.get('title') ?? '';
    // 제목이 없으면 카테고리 라벨이 곧 내용이다 (기존 KPI 통계 화면 대체)
    const source = raw.trim() || (CAT[category]?.label ?? '카더라');

    const lines = titleLines(source).map((l) => sanitizeForOG(l) || l);
    const bar = barColor({ category, title: source });

    const _sqImg = new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', fontFamily: ff, background: BRAND_BG_SOLID }}>
        <BrandCard lines={lines} frame={SIDE} bar={bar} />
      </div>,
      { width: SIDE, height: SIDE, ...opts },
    );
    const _sqBuf = await _sqImg.arrayBuffer();
    return new Response(_sqBuf, { headers: { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', ...CACHE } });
  } catch (err) {
    console.error(`[og-square] cls=${(err as Error)?.constructor?.name} msg=${((err as Error)?.message ?? '').slice(0, 300)}`);
    // 폰트·한글 의존성 없는 최후 폴백 — 미리보기에 무엇이라도 뜨게 한다
    try {
      const fbImg = new ImageResponse(
        (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BRAND_BG_SOLID, color: '#fff', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', fontSize: 28, color: GOLD, letterSpacing: 4, fontWeight: 900 }}>KADEORA</div>
          </div>
        ),
        { width: SIDE, height: SIDE },
      );
      return new Response(await fbImg.arrayBuffer(), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900', 'X-OG-Fallback': '1' },
      });
    } catch {
      return Response.redirect(`${SITE}/images/brand/kadeora-hero.png`, 302);
    }
  }
}
