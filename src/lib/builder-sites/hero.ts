// V17 G — 브랜드 사이트에서 조감도 후보 고르기.
//
// ⚠️ 별칭·세대수와 성격이 다르다. **이미지는 저작물이다.**
//    틀린 세대수는 고치면 되지만 남의 이미지를 잘못 올리면 고치는 걸로 끝나지 않는다.
//    그래서 이 파일의 규칙은 전부 "확실하지 않으면 건너뛴다" 쪽으로 판정한다.
//
// ── 이미지에만 붙는 제약 5가지 ──
//   ① 목록 썸네일이 아니라 **상세/전용 홈페이지의 큰 이미지**. 1200px 미만이면 건너뛴다
//   ② credit 은 **시공사명만**. 화면에 그대로 나가므로 URL·수집일·경로를 넣지 않는다
//   ③ 이미 hero_image_url 이 있으면 **덮어쓰지 않는다** (G-5 를 이미지에도 그대로)
//   ④ **A등급 소스에서만.** 전용 홈페이지로 한 단계 더 들어갈 때는 그 페이지 푸터에
//      시공사명 + 사업자등록번호가 있어야 한다. 없으면 이미지는 건너뛴다
//      (별칭·세대수는 estimated 로 받아도 된다)
//   ⑤ 하루 상한 10건. 되돌릴 일이 생겼을 때 양이 감당돼야 한다
//
// ── 실측 (2026-08-24, ihanulche.co.kr) ──
//   목록 카드   4016×4016 · 1.6MB   ← "축소본" 이 아니었다. 원본을 CSS 로 줄여 쓴다
//   상세 페이지 13465×8976 · 8.6MB  ← 120메가픽셀. 서버리스에서 그냥 열면 위험하다
//   og:image    800×400 브랜드 로고 ← **조감도가 아니다.** og:image 를 믿으면 안 된다

import sharp from 'sharp';

/** 이보다 작으면 쓰지 않는다. apt-cover 가 1600px 로 재인코딩하는데 원본이 작으면 확대되지 않는다. */
export const MIN_HERO_WIDTH = 1200;

/** 원본 상한. 상세 이미지가 8.6MB/120MP 까지 나온다 — 열기 전에 거른다. */
export const MAX_HERO_BYTES = 20 * 1024 * 1024;
export const MAX_HERO_PIXELS = 80_000_000;

/** 이미지 수신 제한시간. 크론 전체를 한 장이 잡아먹으면 안 된다. */
const FETCH_TIMEOUT_MS = 20_000;

const UA = 'Mozilla/5.0 (compatible; kadeora-bot)';

/**
 * 페이지에서 조감도 후보 URL 을 고른다.
 *
 * ⚠️ og:image 를 쓰지 않는다. 실측에서 브랜드 로고(800×400 gif)가 나왔다 —
 *    사이트가 og:image 에 조감도를 넣어 준다는 보장이 없다.
 * 업로드 경로(`/upload/`)의 사진만 후보로 본다. 로고·아이콘·배너는 그 경로에 없다.
 */
export function pickHeroCandidates(html: string, baseUrl: string): string[] {
  const flat = html.replace(/\r?\n/g, ' ');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of flat.matchAll(/<img[^>]*src="([^"]+)"/gi)) {
    const raw = m[1];
    if (!/\/upload\//i.test(raw)) continue;
    if (/\.(svg|gif)(\?|$)/i.test(raw)) continue;
    let abs: string;
    try {
      abs = new URL(raw, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

/**
 * ④ 전용 홈페이지를 A등급으로 인정할 수 있는가.
 * 시공사명 **과** 사업자등록번호가 푸터에 함께 있어야 한다.
 * 하나만 있으면 분양대행 사이트가 시공사명을 적어 둔 것일 수 있다.
 */
export function verifyBrandFooter(html: string, builder: string): boolean {
  const flat = html.replace(/\s+/g, ' ');
  const hasBizNo = /사업자\s*등록\s*번호|사업자번호/.test(flat) && /\d{3}\s*-\s*\d{2}\s*-\s*\d{5}/.test(flat);
  const hasBuilder = flat.includes(builder);
  return hasBizNo && hasBuilder;
}

export interface HeroMeasurement {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * 후보를 실제로 받아 크기를 잰다. 조건을 통과한 **첫 장**만 돌려준다.
 * 하나도 통과 못 하면 null — 지어내지 않는다.
 */
export async function measureFirstUsable(urls: string[]): Promise<HeroMeasurement | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) continue;

      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > MAX_HERO_BYTES) {
        console.log(`[builder/hero] 건너뜀 — 용량 ${(declared / 1048576).toFixed(1)}MB: ${url}`);
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_HERO_BYTES) {
        console.log(`[builder/hero] 건너뜀 — 용량 ${(buf.length / 1048576).toFixed(1)}MB: ${url}`);
        continue;
      }

      const meta = await sharp(buf, { limitInputPixels: MAX_HERO_PIXELS }).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (width * height > MAX_HERO_PIXELS) {
        console.log(`[builder/hero] 건너뜀 — ${width}x${height} 픽셀 과다: ${url}`);
        continue;
      }
      // ① 1200px 미만은 쓰지 않는다. 확대해 봐야 화질이 없다.
      if (width < MIN_HERO_WIDTH) {
        console.log(`[builder/hero] 건너뜀 — ${width}px < ${MIN_HERO_WIDTH}: ${url}`);
        continue;
      }
      return { url, width, height, bytes: buf.length };
    } catch (e: any) {
      console.log(`[builder/hero] 측정 실패 ${url}: ${e?.message ?? String(e)}`);
    }
  }
  return null;
}

/** ⚠️ robots 를 우회하지 않는다. 막혀 있으면 그 소스는 쓰지 않는다. */
export async function robotsAllows(pageUrl: string): Promise<boolean> {
  try {
    const u = new URL(pageUrl);
    const res = await fetch(`${u.origin}/robots.txt`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10_000),
    });
    // robots.txt 가 없으면(404) 제한이 없는 것으로 본다 — 표준 해석이다.
    if (res.status === 404) return true;
    if (!res.ok) return false;

    const txt = await res.text();
    // `User-agent: *` 그룹의 Disallow 만 본다. 우리 봇을 따로 지목한 그룹은 없다.
    const star = /user-agent:\s*\*([\s\S]*?)(?=\nuser-agent:|$)/i.exec(txt);
    const group = star?.[1] ?? txt;
    for (const m of group.matchAll(/^\s*disallow:\s*(\S*)\s*$/gim)) {
      const path = m[1];
      if (!path) continue; // `Disallow:` 빈 값 = 전체 허용
      if (path === '/' || u.pathname.startsWith(path)) return false;
    }
    return true;
  } catch {
    // 확인할 수 없으면 쓰지 않는다. 모르는 채 긁지 않는다.
    return false;
  }
}
