/**
 * B7-1 — 목록에 낼 «표시명» 과 «태그» 를 가른다.
 *
 * ⛔ 원본(`apt_sites.name`)은 «건드리지 않는다». 이건 표시 전용 함수다.
 *
 * ── ⚠️ 「괄호는 부가정보」가 아니다 ─────────────────────────────────────────
 * 꼬리 괄호가 있는 현장 529곳을 세어 보니 «260종» 이고 221종은 한 번만 나온다.
 * 그중 떼도 되는 것은 「청약 유형·차수」 계열뿐이고, 나머지를 같이 떼면 이름이 «나빠진다»:
 *
 *   당리1구역(당리푸르지오)        ← 괄호 안이 «브랜드명» 이다. 떼면 못 알아본다.
 *   성동강변파크빌101(강변타워)     ← 같은 이유
 *   디 아테온(THE ATHEON)         ← 영문 병기
 *   경남아너스빌(1356-0)          ← 지번. 떼도 되지만 판단이 필요하다
 *   e편한세상 분당 퍼스트빌리지(성남낙생지구 A-1BL) 신혼희망타운(공공분양)(본청약)
 *                                ← 괄호가 «중간에도» 있다. 일괄 제거는 이름을 부순다.
 *
 * → «화이트리스트» 로만 뗀다. 모르는 괄호는 그대로 둔다.
 *   못 떼서 이름이 긴 것은 말줄임으로 견딜 수 있지만, 잘못 떼면 되돌릴 수가 없다.
 *
 * ⚠️ 블록·동·단지 코드(A-1BL · 101동 · 1단지)는 «남긴다». 같은 이름의 다른 물건을
 *    구분하는 정보라서다 — T1 에서 시그니처원 Ⅰ/Ⅱ 를 합칠 뻔한 것과 같은 종류의 위험이다.
 */

/** 떼도 되는 꼬리 괄호. ⛔ 여기에 브랜드·블록코드를 넣지 말 것(위 주석). */
const STRIPPABLE = /^(본청약|사전청약|조합원\s*취소분|공공분양|민영주택|국민주택|보류지|예비|추가|잔여세대|\d+회차|\d+차)$/;

export interface DisplayName {
  /** 화면에 낼 이름. */
  name: string;
  /** 이름에서 떼어 낸 부가정보. 2줄 meta 끝에 태그로 붙인다. */
  tags: string[];
}

/**
 * @example
 *   siteDisplayName('더샵 시에르네(조합원 취소분)', '울산', '중구')
 *     → { name: '더샵 시에르네', tags: ['조합원 취소분'] }
 *   siteDisplayName('시흥하중지구 A1블록 신혼희망타운(공공분양)(본청약)', '경기', '시흥시')
 *     → { name: '시흥하중지구 A1블록 신혼희망타운', tags: ['공공분양', '본청약'] }
 *   siteDisplayName('당리1구역(당리푸르지오)', '부산', '사하구')
 *     → { name: '당리1구역(당리푸르지오)', tags: [] }        ← 브랜드는 «안» 뗀다
 *   siteDisplayName('부산 해운대 재건축', '부산', '해운대구')
 *     → { name: '해운대 재건축', tags: [] }
 */
export function siteDisplayName(
  raw: string | null | undefined,
  region?: string | null,
  sigungu?: string | null,
): DisplayName {
  let name = (raw ?? '').trim();
  if (!name) return { name: '', tags: [] };

  // ── ① 꼬리 괄호를 «뒤에서부터» 떼 낸다 ──
  // (공공분양)(본청약) 처럼 두 개가 붙는 경우가 있어 반복한다.
  const tags: string[] = [];
  for (;;) {
    const m = name.match(/\(([^()]+)\)\s*$/);
    if (!m) break;
    const inner = m[1].trim();
    if (!STRIPPABLE.test(inner)) break;      // 모르는 괄호는 «그대로 둔다»
    tags.unshift(inner);
    name = name.slice(0, m.index).trim();
  }

  // ── ② 지역 접두 ──
  // ⚠️ 시군구를 «먼저» 뗀다. '부산 해운대구 ...' 에서 '부산 ' 만 떼면 '해운대구 ' 가 남는다.
  for (const prefix of [
    region && sigungu ? `${region} ${sigungu} ` : '',
    region ? `${region} ` : '',
  ]) {
    if (prefix && name.startsWith(prefix)) {
      const rest = name.slice(prefix.length).trim();
      // ⛔ 떼고 나서 «너무 짧아지면» 떼지 않는다. 「전남 순천시 미분양」 → 「미분양」 같은
      //    결과는 이름이 아니다(집계 행은 목록에서 이미 빠지지만 규칙으로도 막는다).
      if (rest.length >= 2) name = rest;
      break;
    }
  }

  return { name, tags };
}
