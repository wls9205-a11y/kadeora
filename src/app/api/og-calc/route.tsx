/**
 * /api/og-calc — 계산기 결과 OG 이미지
 *
 * 카카오톡 / 네이버 블로그 / 페이스북 공유 시 결과값이 큰 이미지로 노출
 * → 자연 백링크 + CTR 폭증
 *
 * T1 §3.1: 확정 규격(A안) 적용. 계산기명은 §2 로 추출한다.
 *   - 배경 9색 테마 맵(#0a1f1c 등)을 브랜드 네이비 하나로 통일
 *   - 이모지 8종(🏠💼📈📊💰🏦🎁👴) 제거 — satori 이모지 금지(§4)
 *   - 결과값은 이 카드의 «본체» 라 유지하되 골드는 여기 한 곳만 쓴다(§1.4).
 *     그래서 제목 강조줄은 accent={-1} 로 끈다.
 *
 * Edge runtime 대신 Node 런타임 사용 (한글 폰트 fs.readFileSync)
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeForOG } from '@/lib/og-sanitize';
import { barColor, titleLines, fitFontSize, BRAND_BG_SOLID, GOLD } from '@/lib/og/brand';
import { BrandCard } from '@/lib/og/frame';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const W = 1200;
const H = 630;

/**
 * ⚠️ 원래는 public/fonts/Pretendard-{Medium,Bold}.otf 를 읽었는데 그 파일들이 없다
 *    (public/fonts 에는 NotoSansKR-Bold.woff 와 pretendard/*.woff2 서브셋뿐).
 *    existsSync 가드에 걸려 조용히 fonts: undefined 로 넘어가고 있었다 — 한글이 폰트
 *    없이 렌더되면 satori 가 외부 dynamic font fetch 를 시도하고, 이 서버리스 환경에서는
 *    항상 실패한다(s248/s280 과 같은 원인). 나머지 8개 생성기와 같은 폰트로 맞춘다.
 */
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
  const u = req.nextUrl;
  const result = sanitizeForOG(u.searchParams.get('result') || '');
  // 호출부는 rec.result.main.label ?? calc.titleShort 를 넘긴다 — 이게 계산기명이다
  const label = u.searchParams.get('label') || '계산 결과';
  const category = u.searchParams.get('category') || 'real-estate';

  const fontData = loadFont();
  const fontOpts = fontData
    ? { fonts: [{ name: 'NotoSansKR', data: fontData, style: 'normal' as const, weight: 700 as const }] }
    : {};
  const ff = fontData ? 'NotoSansKR, sans-serif' : 'sans-serif';

  // ⚠️ 원문 → titleLines → 줄 단위 sanitize 순서. 먼저 씻으면 em dash 가 '-' 로 바뀌어
  //    §2 절단이 안 먹는다('-' 는 범천1-1 때문에 절단 문자에서 일부러 빠져 있다).
  const lines = titleLines(label).map((l) => sanitizeForOG(l) || l);
  const bar = barColor({ category: 'finance', subCategory: category, title: label });

  // 계산기명은 부제 역할이라 눌러 잡고, 결과값이 화면을 지배한다.
  const resultFS = result ? fitFontSize([result], W, Math.round(H * 0.55)) : 0;

  const below = result ? (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        marginTop: Math.round(H * 0.045),
        fontSize: resultFS,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: -resultFS * 0.046,
        color: GOLD,
      }}
    >
      {result}
    </div>
  ) : null;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', fontFamily: ff, background: BRAND_BG_SOLID }}>
        <BrandCard
          lines={lines}
          frame={W}
          height={H}
          bar={bar}
          below={below}
          titleScale={result ? 0.38 : 1}
          accent={result ? -1 : undefined}
        />
      </div>
    ),
    { width: W, height: H, ...fontOpts },
  );
}
