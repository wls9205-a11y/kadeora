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
