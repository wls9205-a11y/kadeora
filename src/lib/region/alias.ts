// 지역명 별칭 — «사용자 머릿속 지명» 을 현재 라벨로.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 행정구역 개편은 하루아침에 되지만 사람 머릿속 지명은 «몇 년» 걸린다.
// 「강원도 춘천」으로 검색하는 사람에게 「그런 지역 없음」을 돌려주면 그건 우리 잘못이다.
// 개편 «전» 이름으로 검색해도 «후» 지역에 닿아야 한다.
//
// ⛔ 이 표는 «검색·자동완성 전용» 이다. 수집·URL·저장에 쓰지 말 것 —
//    거긴 코드가 진실이고(lawd.ts), 여기는 사람 말이 입력이다.
// ⛔ 옛 이름을 «되살리지» 않는다. 화면 표기는 언제나 현재 라벨이다.
//    별칭은 «들어오는 말» 만 넓히고 «나가는 말» 은 넓히지 않는다.

import { LAWD_LABELS } from '@/lib/region/lawd';

/**
 * 옛 이름 → 현재 라벨.
 *
 * ⚠️ 값은 «lawd.ts 에 실재하는 라벨» 이어야 한다. 없는 라벨을 가리키는 별칭은
 *    「검색은 되는데 아무 데도 안 가는」 길이 된다 — 테스트가 그것을 잡는다.
 */
const ALIAS: Record<string, string> = {};

/** 시도 이름만 바뀐 개편 — 시군 이름은 그대로다. 접두만 갈아 끼운다. */
const SIDO_RENAME: Record<string, string> = {
  // 2023-06 강원특별자치도 · 2024-01 전북특별자치도.
  // 코드도 42→51 · 45→52 로 바뀌었고 lawd.ts 는 이미 신코드를 쓴다.
  강원도: '강원',
  전라북도: '전북',
  전북도: '전북',
  // 「강원 춘천시」를 「강원도 춘천시」로 부르는 입력까지 받는다.
};

/**
 * 시군구 자체가 옮겨간 경우. ⚠️ 여기는 «시도가 달라지므로» 접두 치환으로 안 된다.
 */
const MOVED: Record<string, string> = {
  // 2023-07 경북 → 대구 이관. 옛 코드 47720 은 StanReginCd 에서 이미 0행이다.
  '경북 군위군': '대구 군위군',
  '경북 군위': '대구 군위군',
};

for (const [from, to] of Object.entries(MOVED)) ALIAS[from] = to;

/**
 * 입력 문자열을 현재 라벨로 정규화한다. 못 찾으면 **null** —
 * ⛔ 「비슷한 것」을 돌려주지 않는다. 틀린 지역으로 보내는 것보다 못 찾는 편이 낫다.
 */
export function resolveRegionAlias(input: string | null | undefined): string | null {
  const q = (input ?? '').trim().replace(/\s+/g, ' ');
  if (!q) return null;

  // ① 이미 현재 라벨이면 그대로.
  if (LAWD_LABELS.includes(q)) return q;

  // ② 통째로 옮겨간 시군구.
  if (ALIAS[q]) return ALIAS[q];

  // ③ 시도 이름만 옛것인 경우 — 접두를 갈아 끼우고 다시 본다.
  const [head, ...rest] = q.split(' ');
  const newHead = SIDO_RENAME[head];
  if (newHead && rest.length) {
    const swapped = [newHead, ...rest].join(' ');
    if (LAWD_LABELS.includes(swapped)) return swapped;
  }
  return null;
}

/**
 * 자동완성용 — 이 입력이 «옛 이름» 인가. 화면에 「지금은 OOO 입니다」를 붙일 때 쓴다.
 * ⚠️ 사용자가 틀린 게 아니라 «세상이 바뀐» 것이므로 문구가 나무라지 않아야 한다.
 */
export function isLegacyRegionName(input: string): boolean {
  const q = input.trim();
  if (LAWD_LABELS.includes(q)) return false;
  return resolveRegionAlias(q) !== null;
}

/**
 * ⚠️⚠️ 광주·전남은 «아직 없다».
 *
 * StanReginCd 는 29(광주)·46(전남)을 «12 전남광주통합특별시» 로 통합했지만,
 * 우리 lawd.ts 는 아직 29·46 을 쓴다 — 건축HUB 가 어느 세대를 받는지 «미실측» 이라
 * 바꾸지 않았다(HANDOFF A-1).
 *
 * ⛔ 그래서 「광주 서구」 → 신라벨 별칭을 «지금 걸 수 없다». 가리킬 라벨이 없다.
 *    없는 라벨을 가리키는 별칭은 「검색은 되는데 아무 데도 안 가는」 길이다.
 * → A-1 답이 오고 15시도 전환이 끝나면, 그때 광주 5구 · 전남 22곳을 MOVED 에 넣는다.
 *    구조는 이미 준비돼 있다 — 표에 줄만 추가하면 된다.
 */
export const PENDING_MERGE_NOTE = '광주·전남 별칭은 15시도 전환(HANDOFF A-1) 후 등재';
