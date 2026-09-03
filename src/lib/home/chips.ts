// H4-1 (c)(d) — 홈 히어로 검색창 아래 칩 줄의 «소스와 라벨».
//
// ── 왜 별도 파일인가 ──
// 라벨과 소스가 «반드시 같이» 움직여야 하기 때문이다. 칩을 A 에서 뽑아 놓고
// 라벨은 B 를 말하면, H3-3 에서 trending_keywords 를 끊어낸 이유가 그대로 재발한다.
// 한 함수가 둘을 같이 내면 갈라질 수가 없다. 테스트로도 잠근다.
//
// ── 폐기된 소스 (되살리지 말 것) ──
//
//   `page_views`  — 합성값이다. 컬럼 총합 200,655 대 실제 page_views 테이블 3개월
//                   apt 경로 1,941 (100배 괴리). 부울경 PV 상위 12곳의 실조회가 전부 0이고
//                   PV 9위가 `2020.2.7. LH 국민임대 예비입주자 모집공고` 였다.
//                   「인기」 정렬 근거로 쓰지 않는다. (크론의 배치 대상 선정은 그대로 둔다 —
//                   그건 순위 노출이 아니다.)
//   `content_score` — 중복 생존자를 고르는 값이지 사람이 본 흔적이 아니다 (RULES#118).
//   `trending_keywords` — 상위 12건이 전부 heat_score 100, `2026` `아파트` 혼입, 경기·서울 혼입.
//   `search_logs`   — 30일 클릭 0 · 로그인 0 · 새벽 4~5시가 최고치. 크롤러다.
//
// ── 「인기」 라벨을 쓰지 않는다 ──
// 부울경에서 30일간 사람이 3회 이상 본 현장이 «0곳» 이다(235곳에 858건 흩어짐).
// 순위를 만들 신호가 없다. 계측부터 붙이고(H4-3) 데이터가 쌓인 뒤 라벨만 승격한다.

/** 칩에 쓸 수 있는 이름 길이. 넘으면 검색창에서 잘린다 (실측: 23자 → 잘림). */
const NAME_MIN = 2;
const NAME_MAX = 16;

/** 칩 줄에 올리는 최대 개수. 모자라면 있는 만큼만 — 빈 자리를 만들지 않는다. */
export const CHIP_LIMIT = 5;

export const CHIP_LABEL_CURATED = '지금 계약 가능한 현장';
export const CHIP_LABEL_MOVES = '최근 움직인 현장';

/** 이름 목록을 칩에 쓸 수 있는 형태로 거른다 — 길이 · 공백 · 중복. */
export function pickChipNames(raw: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const n = String(r ?? '').replace(/\s+/g, ' ').trim();
    if (n.length < NAME_MIN || n.length > NAME_MAX) continue;
    if (out.includes(n)) continue;
    out.push(n);
  }
  return out;
}

export interface HomeChips {
  names: string[];
  /** 칩이 0개면 빈 문자열. 호출부가 줄을 통째로 미렌더한다. */
  label: string;
}

/**
 * 칩 줄을 만든다. **두 소스를 섞지 않는다.**
 *
 * ⚠️ 지시서는 「큐레이션이 5개에 모자라면 최근 움직인 현장으로 채운다」였다.
 *    그대로 하면 라벨이 거짓이 된다 — 단계가 바뀐 현장(`센트레빌 아스테리움 거제` 등)은
 *    「지금 계약 가능」이 아니다. 라벨 하나에 두 종류를 담을 방법이 없어서
 *    **소스를 통째로 고르고 라벨을 거기 맞춘다.**
 *      · 큐레이션이 하나라도 있으면 → 큐레이션만, 「지금 계약 가능한 현장」
 *      · 하나도 없으면            → 최근 움직인 현장만, 「최근 움직인 현장」
 *    칩이 5개가 안 되는 건 감수한다. 실측 큐레이션은 4건이다(부산 4 · 울산 0 · 경남 0).
 *    5개를 채우려고 라벨을 거짓말시키지 않는다 — 그게 §1-2 의 요지다.
 *
 * ⚠️ 두 번째 소스는 «이미 홈이 부른» get_apt_recent_moves 의 결과를 받아 쓴다.
 *    여기서 다시 조회하지 않는다 — 칩 하나 때문에 홈 쿼리를 늘리지 않는다.
 */
export function buildHomeChips(opts: {
  curated: (string | null | undefined)[];
  moves: (string | null | undefined)[];
  limit?: number;
}): HomeChips {
  const limit = opts.limit ?? CHIP_LIMIT;

  const curated = pickChipNames(opts.curated).slice(0, limit);
  if (curated.length > 0) return { names: curated, label: CHIP_LABEL_CURATED };

  const moves = pickChipNames(opts.moves).slice(0, limit);
  if (moves.length > 0) return { names: moves, label: CHIP_LABEL_MOVES };

  return { names: [], label: '' };
}
