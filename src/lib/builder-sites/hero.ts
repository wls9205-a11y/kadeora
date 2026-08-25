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
/**
 * 후보 상한. 전용 홈페이지는 이미지가 수십 장이라(riverfront 57장) 전부 받으면
 * 크론 한 번이 수백 MB 를 당긴다. 큰 이미지는 대개 앞쪽에 있다.
 */
const MAX_CANDIDATES = 12;

/**
 * 화면 자산(조감도가 아닌 것) 이름 패턴.
 *
 * ⚠️ **크기만으로는 못 거른다.** 2026-08-25 실측(prugio-riverfront.com):
 *      13x13     popup_closeBtn.v100.png      ← 크기로 걸린다
 *      1920x950  main_calendar_bg.jpg         ← **크기를 통과한다. 달력 배경이다.**
 *      280x280   main_visual_deco_img_01.jpg  ← 크기로 걸린다
 *    measureFirstUsable 은 통과한 **첫 장**을 쓰므로, 이름을 안 보면
 *    달력 배경이 「대우건설 조감도」credit 을 달고 현장 페이지에 올라간다.
 */
const CHROME_ASSET = /(?:^|[/_-])(?:bg|background|btn|button|icon|ico|logo|bi|deco|popup|layer|banner|calendar|arrow|dot|bullet|sprite|pattern|patt|thumb|nav|menu|footer|header|loading|spinner)(?:[/_.-]|$)/i;

/**
 * 조감도로 볼 수 있는 파일명 패턴. **허용목록이다 — 여기 없으면 쓰지 않는다.**
 *
 * ⚠️ 화면 자산을 뺀 것만으로는 부족했다. 남은 첫 통과분이
 *    `ls_intro_feature.webp`(1851x1234) 였는데 **조경·커뮤니티 렌더지 조감도가 아니다.**
 *    그게 현장 페이지 히어로에 「단지 조감도」처럼 올라가면 사실과 다르다.
 *    이름으로 조감도인지 확신할 수 없으면 **그 사이트는 이미지 없이 둔다.**
 *    빈 손으로 두는 쪽이 틀린 사진을 올리는 것보다 낫다 — 이 파일의 원칙 그대로다.
 */
const HERO_HINT = /(?:bird|aerial|조감|view|main_visual)/i;

export function pickHeroCandidates(
  html: string,
  baseUrl: string,
  opts: { requireUploadPath?: boolean } = {},
): string[] {
  const requireUploadPath = opts.requireUploadPath !== false;
  const flat = html.replace(/\r?\n/g, ' ');
  const out: string[] = [];
  const seen = new Set<string>();
  // 작은따옴표 속성도 받는다 — 전용 홈페이지는 마크업 스타일이 제각각이다.
  for (const m of flat.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)) {
    const raw = m[1];
    // ⚠️ `/upload/` 강제는 **하늘채 기준**이다. 전용 홈페이지는 경로가 제각각이라
    //    (`/resources/img/…` · `/bon/img/…`) 강제하면 후보가 0건이 된다(실측).
    //    그쪽에서는 크기 게이트(1200px)가 로고·버튼을 걸러 준다.
    if (requireUploadPath && !/\/upload\//i.test(raw)) continue;
    if (/\.(svg|gif)(\?|$)/i.test(raw)) continue;
    if (/^data:/i.test(raw)) continue;
    // ⚠️ 실제 이미지 확장자만 받는다. 실측에서 `item.img` 라는 **템플릿 자리표시자**가
    //    후보로 올라왔다 — 점이 있다고 주소인 게 아니다.
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(raw)) continue;
    let abs: string;
    let u: URL;
    try {
      abs = new URL(raw, baseUrl).toString();
      u = new URL(abs);
    } catch {
      continue;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    // ⚠️ **동일 출처만.** 실측에서 `facebook.com/tr?id=…` 추적 픽셀이 후보로 잡혔다.
    //    남의 도메인 이미지를 「시공사 공식 사이트」credit 으로 올리면 출처가 거짓이 된다 —
    //    이 파일이 지키려는 바로 그 선이다.
    if (u.origin !== new URL(baseUrl).origin) continue;
    // ⚠️ `/upload/` 를 요구하지 않는 소스에서는 경로가 걸러 주는 게 없다.
    //    화면 자산 이름을 명시적으로 뺀다 — 안 그러면 달력 배경이 조감도로 나간다(실측).
    if (!requireUploadPath) {
      // ⚠️ 순서가 중요하다 — 허용목록을 먼저 통과해도 화면 자산이면 버린다.
      //    `main_visual_deco_img_01` 은 힌트(main_visual)를 갖지만 deco 다.
      if (!HERO_HINT.test(u.pathname)) continue;
      if (CHROME_ASSET.test(u.pathname)) continue;
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
    if (out.length >= MAX_CANDIDATES) break;
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
