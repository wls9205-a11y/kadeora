// V17 G — 시공사 브랜드 사이트 「분양단지 목록」 파서.
//
// 구조는 실측으로 정했다 (ihanulche.co.kr/sale/list, 2026-08-24):
//
//   <li>
//     <div class="imgs"><a class="view"><img src="…" alt="상주북천 하늘채 파크원"></a></div>
//     <div class="info-box"><div class="info-text">
//       <div class="title pre-space">상주북천 하늘채 파크원</div>
//       <table><tbody>
//         <tr><th>분양 시기</th><td>2026.05.08</td></tr>
//         <tr><th>현장 위치</th><td>경북 상주시 냉림동 53번지 일원</td></tr>
//         <tr><th>총 세대수</th><td>466세대</td></tr>
//       </tbody></table>
//     …
//     <a href="https://sangju-hanulche.com/" class="page-trg">홈페이지</a>
//
// **라벨(<th>)로 값을 찾는다.** class 이름은 사이트마다 다르지만 라벨은 업계 공통이다.
// 셀렉터에 기대면 사이트가 클래스 하나 바꿀 때마다 조용히 0건이 된다.
//
// ⚠️ 카드 경계를 `<li>` 단순 분할로 잡으면 안 된다. 카드 안에 util-list 의 중첩 `<li>` 가
//    있어서 표 뒤에 오는 **전용 홈페이지 링크가 잘려 나간다.**
//    카드 시작점만 찾아 다음 시작점까지를 한 덩어리로 본다.

import { formatRegionShortSafe } from '@/lib/apt/subscription-status';

/** 총 세대수 셀의 실측 형식 3종. */
export interface UnitsCell {
  /** 단지 전체(조합원분 포함). */
  complex: number | null;
  /** 이번 분양 공급. `A세대 중 일반분양 B세대` 형식에서만 나온다. */
  supply: number | null;
}

const num = (s: string): number | null => {
  const n = Number(s.replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * 총 세대수 셀 파싱. 실측 3형식 + 일반분양 단독.
 *
 *   `466세대`                          → complex 466
 *   `1,670세대 중 일반분양 1,061세대`   → complex 1,670 · supply 1,061
 *   `아파트 총 1,242세대`               → complex 1,242
 *
 * ⚠️ `A세대 중 … B세대` 에서 **앞 숫자가 단지 전체**다. 뒤 숫자를 complex 로 잡으면
 *    화면이 1,061세대 단지라고 말하게 된다 — 실제로 그렇게 나가고 있던 버그다.
 */
export function parseUnitsCell(raw: string): UnitsCell {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return { complex: null, supply: null };

  // ① A세대 중 (일반분양) B세대
  const both = /([\d,]+)\s*세대\s*중\D{0,10}?([\d,]+)\s*세대/.exec(t);
  if (both) return { complex: num(both[1]), supply: num(both[2]) };

  // ①-b 총 A세대 (일반분양 B세대)  — 더샵 모바일 목록 실측 형식 (2026-08-25)
  //     `총 788세대(일반분양 231세대)` · `총 647세대 (일반분양 84세대)` 괄호 앞 공백이 섞인다.
  // ⚠️ 반드시 ② 보다 **앞에** 둘 것. ② 가 먼저 걸리면 앞 숫자(단지 전체)를 통째로 버리고
  //    일반분양 수치만 남는다 — 647세대 단지가 84세대 단지로 나가는, 이 파일이 막으려던 그 버그다.
  const paren = /([\d,]+)\s*세대\s*\(\s*일반분양\s*([\d,]+)\s*세대\s*\)/.exec(t);
  if (paren) return { complex: num(paren[1]), supply: num(paren[2]) };

  // ② 일반분양만 적힌 경우 — 단지 전체는 모른다
  const onlySupply = /일반분양\s*([\d,]+)\s*세대/.exec(t);
  if (onlySupply) return { complex: null, supply: num(onlySupply[1]) };

  // ③ 숫자 하나 = 단지 전체 ('총' · '아파트 총' 접두 포함)
  const single = /([\d,]+)\s*세대/.exec(t);
  if (single) return { complex: num(single[1]), supply: null };

  return { complex: null, supply: null };
}

export interface BuilderSiteCard {
  name: string;
  /** 상세 페이지 번호 (data-no). 조감도는 목록 썸네일이 아니라 상세에서 가져온다. */
  detailNo: string | null;
  /** 현장 위치 원문 (지번까지). 지역 대조에 쓴다. */
  address: string | null;
  saleDate: string | null;
  units: UnitsCell;
  /** 조감도 후보. 목록 카드의 대표 이미지다. */
  imageUrl: string | null;
  /** 단지 전용 홈페이지. 별칭의 또 다른 출처다. */
  homepage: string | null;
}

const decode = (s: string): string =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** 카드 블록 안에서 `<th>라벨</th><td>값</td>` 을 찾는다. 라벨은 부분 포함으로 본다. */
function labelValue(block: string, label: string): string | null {
  const re = new RegExp(`<th[^>]*>\\s*[^<]*${label}[^<]*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i');
  const m = re.exec(block);
  return m ? decode(m[1]) || null : null;
}

function absolute(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

/**
 * 목록 HTML → 카드 배열.
 *
 * ⚠️ 같은 단지가 두 번 실리는 경우가 있다 (실측: 금정산 하늘채 루미엘).
 *    이름 기준으로 접는다.
 * ⚠️ 이름이나 주소가 없으면 카드로 치지 않는다 — 매칭 근거가 없다.
 */
export function parseBuilderList(html: string, baseUrl: string): BuilderSiteCard[] {
  const flat = html.replace(/\r?\n/g, ' ');
  const out: BuilderSiteCard[] = [];
  const seen = new Set<string>();

  // 카드 경계는 **제목 기준**으로 잡는다.
  //   <li> 를 앞에서부터 훑으면 카드 안 util-list 의 중첩 <li> 까지 시작점으로 잡혀
  //   블록이 잘게 부서진다 (실측: 카드 6장인데 시작점 27개, 첫 블록 101자).
  //   제목은 카드당 하나뿐이라 이걸 닻으로 쓰면 중첩에 흔들리지 않는다.
  const titleRe = /class="[^"]*\btitle\b[^"]*"[^>]*>/gi;
  const starts: number[] = [];
  for (const m of flat.matchAll(titleRe)) {
    // 제목을 감싸는 <li> 로 되돌아간다. 없으면 카드가 아니다 (페이지 헤더 등).
    const liStart = flat.lastIndexOf('<li', m.index);
    if (liStart >= 0 && (starts.length === 0 || liStart > starts[starts.length - 1])) starts.push(liStart);
  }
  const blocks = starts.map((start, i) => flat.slice(start, starts[i + 1] ?? flat.length));

  for (const block of blocks) {
    const titleM = /class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block);
    const name = titleM ? decode(titleM[1]) : '';
    if (!name || name.length < 2) continue;

    const address = labelValue(block, '위치');
    const unitsRaw = labelValue(block, '세대');
    // 이름만 있고 위치·세대수가 둘 다 없으면 목록 카드가 아니다 (탭·메뉴 <li>).
    if (!address && !unitsRaw) continue;

    const key = name.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);

    const imgM = /<img[^>]*src="([^"]+)"/i.exec(block);
    // 전용 홈페이지 — tel: · javascript: 는 제외한다.
    const hpM = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*class="[^"]*page-trg/i.exec(block)
      ?? /<a[^>]*class="[^"]*page-trg[^"]*"[^>]*href="(https?:\/\/[^"]+)"/i.exec(block);

    out.push({
      name,
      detailNo: /data-no="(\d+)"/i.exec(block)?.[1] ?? null,
      address,
      saleDate: labelValue(block, '시기'),
      units: parseUnitsCell(unitsRaw ?? ''),
      imageUrl: absolute(imgM?.[1] ?? null, baseUrl),
      homepage: hpM?.[1] ?? null,
    });
  }

  return out;
}

/* ══════════════════════ ADDENDUM §3-2 · 브랜드 4곳 프로파일 ══════════════════════
 *
 * 2026-08-25 실측. **경로 3개가 지시서와 달랐다** — 확정본은 registry.ts 참고.
 * 네 사이트가 구조가 전부 다르다. 라벨 파싱 하나로 안 되므로 프로파일을 나눈다.
 */

/**
 * 프로파일 `plan-table` — 푸르지오 `/sale/plan.aspx` 「분양계획 한눈에 보기」.
 *
 * 단일 `<table>` 이고 헤더가 그대로 두 축을 준다:
 *   구분 | 단지명 | **전체가구수(실)** | **공급수(실)** | 전화번호 | 공급유형 | 홈페이지 | 비고
 *   써밋 더힐        1,515 / 432
 *   부산 괴정3구역     757 / 228
 *
 * ⚠️ 월 셀에 `rowspan` 이 걸려 있어 행마다 `<td>` 개수가 8개 또는 7개다.
 *    인덱스로 세면 한 칸씩 밀린다 — **뒤에서부터** 세거나 열 수를 보고 오프셋을 잡는다.
 * ⚠️ 공급유형이 `오피스텔` 인 행이 섞인다. 아파트 현장과 세대수를 섞지 않는다.
 * ⚠️ 이 표에는 이미지가 없다(홈페이지 아이콘뿐). 조감도는 여기서 얻을 수 없다.
 */
export function parsePlanTable(html: string): BuilderSiteCard[] {
  const flat = html.replace(/\r?\n/g, ' ');
  const out: BuilderSiteCard[] = [];
  const seen = new Set<string>();

  for (const rowM of flat.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowM[1];
    if (/<th[\s>]/i.test(row)) continue; // 헤더 행

    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    // 월 셀(rowspan)이 있으면 8칸, 없으면 7칸이다. **뒤에서부터** 센다.
    if (tds.length < 7) continue;
    const tail = tds.slice(-7); // 단지명 · 전체 · 공급 · 전화 · 유형 · 홈페이지 · 비고

    const name = decode(tail[0]);
    if (!name || name.length < 2) continue;

    const kind = decode(tail[4]);
    // ⚠️ 오피스텔은 아파트 현장과 다른 물건이다. 세대수를 섞으면 규모가 틀어진다.
    if (kind && !kind.includes('아파트')) continue;

    const complex = num(decode(tail[1]));
    const supply = num(decode(tail[2]));

    const key = name.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name,
      detailNo: null,
      address: null, // 이 표는 주소를 주지 않는다. 지역 대조는 이름으로만 가능하다.
      saleDate: null,
      units: { complex, supply },
      imageUrl: null, // 이미지 없음 — 지어내지 않는다
      homepage: /<a[^>]*href='([^']+)'/i.exec(tail[5])?.[1]
        ?? /<a[^>]*href="([^"]+)"/i.exec(tail[5])?.[1]
        ?? null,
    });
  }

  return out;
}

/**
 * 프로파일 `data-attr` — 롯데캐슬 `/aptInfo/lots/list.do`.
 *
 * 카드마다 `heart_icon` 요소가 **네 축을 data 속성으로** 들고 있다. 표를 읽을 필요가 없다:
 *   data-apt-nm · data-loctn · data-tot-houshd-cnt · data-genrl-houshd-cnt
 *   data-guild-houshd-cnt · data-lease-houshd-cnt · data-lots-dt · data-apt-cd
 *
 * ⚠️ 화면 표기(`1542세대 (일반 : 1542)`)를 파싱하지 말 것. 같은 값이 속성에 정수로 있다.
 */
export function parseDataAttrList(html: string, baseUrl: string): BuilderSiteCard[] {
  const flat = html.replace(/\r?\n/g, ' ');
  const out: BuilderSiteCard[] = [];
  const seen = new Set<string>();

  // 카드 경계: heart_icon 이 카드당 하나다. 그 앞의 list_box 시작까지가 한 덩어리.
  const heartRe = /<div class="heart_icon[^"]*"[^>]*>/gi;
  for (const m of flat.matchAll(heartRe)) {
    const attrs = m[0];
    const name = decode(/data-apt-nm="([^"]*)"/i.exec(attrs)?.[1] ?? '');
    if (!name || name.length < 2) continue;

    const key = name.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);

    const boxStart = flat.lastIndexOf('<div class="list_box"', m.index);
    const block = boxStart >= 0 ? flat.slice(boxStart, m.index) : '';

    const attr = (k: string) => new RegExp(`data-${k}="([^"]*)"`, 'i').exec(attrs)?.[1] ?? '';

    out.push({
      name,
      detailNo: attr('apt-cd') || null,
      address: decode(attr('loctn')) || null,
      saleDate: attr('lots-dt') || null,
      units: { complex: num(attr('tot-houshd-cnt')), supply: num(attr('genrl-houshd-cnt')) },
      // 목록 이미지가 실제 URL 이다(base64 가 아니다). 크기 검증은 hero.ts 가 한다.
      imageUrl: absolute(/<div class="img">\s*<img[^>]*src="([^"]+)"/i.exec(block)?.[1] ?? null, baseUrl),
      homepage: null, // 상세(/APT/{code}/main/index.do)는 자사 도메인이라 별칭 출처가 아니다
    });
  }

  return out;
}

/**
 * 프로파일 `mobile-card` — 더샵 **모바일** `m.thesharp.co.kr/pages/plan/sales.aspx`.
 *
 * ⚠️ PC 목록은 세대수를 한 축(`111세대`)만 주는데 **모바일이 두 축을 준다.**
 *    `총 788세대(일반분양 231세대)` · `총 647세대 (일반분양 84세대)` — 괄호 앞 공백이 섞인다.
 *    상세 페이지를 현장마다 여는 대신 모바일 목록 한 장이면 끝난다.
 *
 * ⚠️ **이미지는 가져오지 않는다.** robots 에 `Disallow: /upload/` 가 있고
 *    이미지 경로가 `/upload/prj/…` 다. 우회하지 않는다.
 */
export function parseMobileCardList(html: string): BuilderSiteCard[] {
  const flat = html.replace(/\r?\n/g, ' ');
  const out: BuilderSiteCard[] = [];
  const seen = new Set<string>();

  // 제목(<dt>)을 닻으로 카드 경계를 잡는다 — 중첩 <li> 에 흔들리지 않는다.
  const dtRe = /<dt[^>]*>([\s\S]*?)<\/dt>/gi;
  const marks = [...flat.matchAll(dtRe)];

  marks.forEach((m, i) => {
    const name = decode(m[1]);
    if (!name || name.length < 2) return;
    const block = flat.slice(m.index, marks[i + 1]?.index ?? flat.length);

    const pick = (label: string) =>
      decode(
        new RegExp(`<strong[^>]*>\\s*${label}\\s*<\\/strong>\\s*<em[^>]*>([\\s\\S]*?)<\\/em>`, 'i').exec(block)?.[1] ?? '',
      ) || null;

    const address = pick('위치');
    const unitsRaw = pick('세대수');
    if (!address && !unitsRaw) return;

    const key = name.replace(/\s+/g, '');
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      name,
      detailNo: /hPROJECT_ID=(P_\d+)/i.exec(block)?.[1] ?? null,
      address,
      saleDate: pick('분양시기'),
      units: parseUnitsCell(unitsRaw ?? ''),
      imageUrl: null, // robots Disallow: /upload/ — 가져오지 않는다
      homepage: /<a[^>]*href='(https?:\/\/[^']+)'/i.exec(block)?.[1]
        ?? /<a[^>]*href="(https?:\/\/[^"]+)"/i.exec(block)?.[1]
        ?? null,
    });
  });

  return out;
}

/**
 * 프로파일 `ajax-card` — 두산위브 `POST /lttot/lttotCompl/lttotComplexListAjax.do`.
 *
 * ⚠️ **세대수를 넣지 않는다.** `<dd><span>세대수</span>2,088 세대</dd>` 는 라벨이 하나뿐이라
 *    단지 전체인지 공급분인지 판단할 근거가 없다. 잘못 넣으면 §3-2 가 풀려는 문제를
 *    그대로 재생산한다 — 애매하면 안 넣는다.
 * ⚠️ **이미지도 못 쓴다.** 목록 이미지가 `src="data:image/jpg;base64,…"` 로 인라인이라
 *    URL 이 없고 응답이 17.5MB 다(base64 제거 시 8.6KB). 썸네일이라 1200px 기준도 못 넘는다.
 *
 * 이 소스에서 얻는 것은 **별칭(단지명·전용 홈페이지)과 위치**뿐이다.
 */
export function parseAjaxCardList(html: string): BuilderSiteCard[] {
  // base64 이미지를 먼저 걷어낸다. 안 그러면 정규식이 17MB 문자열을 훑는다.
  const flat = html.replace(/src="data:image[^"]*"/gi, 'src=""').replace(/\r?\n/g, ' ');
  const out: BuilderSiteCard[] = [];
  const seen = new Set<string>();

  const marks = [...flat.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/gi)];
  marks.forEach((m, i) => {
    const name = decode(m[1]);
    if (!name || name.length < 2) return;
    const block = flat.slice(m.index, marks[i + 1]?.index ?? flat.length);

    const pick = (label: string) =>
      decode(
        new RegExp(`<span[^>]*>\\s*${label}\\s*<\\/span>([\\s\\S]*?)<\\/dd>`, 'i').exec(block)?.[1] ?? '',
      ) || null;

    const address = pick('위치');
    if (!address) return;

    const key = name.replace(/\s+/g, '');
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      name,
      detailNo: null,
      address,
      saleDate: pick('입주예정'),
      // ⚠️ 의도적으로 비운다. 위 주석 참고.
      units: { complex: null, supply: null },
      imageUrl: null,
      homepage: /window\.open\('(https?:\/\/[^']+)'/i.exec(block)?.[1] ?? null,
    });
  });

  return out;
}

/**
 * 현장 위치 원문에서 시·도와 시군구를 뽑는다.
 * `경북 상주시 냉림동 53번지 일원` → { region: '경북', sigungu: '상주시' }
 *
 * ⚠️ 매칭 채택 조건에 쓴다. 지역이 다르면 이름이 같아도 채택하지 않는다.
 */
export function parseAddress(address: string | null): { region: string | null; sigungu: string | null } {
  const t = (address ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return { region: null, sigungu: null };
  const parts = t.split(' ');
  return {
    // ⚠️ 브랜드 사이트는 풀네임을 쓴다 (실측 '부산광역시'). apt_sites.region 은 축약형('부산')이다.
    //    축약 규칙은 이미 있으니 다시 만들지 않는다 — '경상남도'→'경남' 은 접미사 제거로 안 나온다.
    region: parts[0] ? formatRegionShortSafe(parts[0]) || null : null,
    sigungu: parts[1] && /(시|군|구)$/.test(parts[1]) ? parts[1] : null,
  };
}
