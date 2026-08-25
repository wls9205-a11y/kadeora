// 블로그 제목 길이 맞추기.
//
// ⚠️ DB 트리거 validate_blog_post 가 제목을 두 방향으로 막는다:
//      LENGTH(TRIM(title)) < 10  → TITLE_TOO_SHORT
//      LENGTH(title)      > 80   → TITLE_TOO_LONG
//    그런데 그 P0001 이 safeBlogInsert 에서 **duplicate_slug 로 뭉뚱그려져** 올라온다.
//    실제로 §4-4 주간 크론이 "슬러그 중복" 으로 보고됐는데 원인은 제목 길이였다.
//    아파트명은 구역명보다 훨씬 길다 — `센트레빌 아스테리움 거제` 하나가 12자다.
//    §4-1(구역명 3개)은 통과하고 §4-4(단지명 3개)는 넘친다.
//
// 그래서 제목을 만들 때 **대표 이름 개수를 줄여가며** 들어가는 형태를 고른다.
// 이름이 하나도 안 들어가도 제목은 성립해야 한다 — 그게 마지막 안전망이다.

/** DB CHECK 와 같은 값. 여기서 바꾸면 트리거와 어긋난다. */
export const TITLE_MAX = 80;
export const TITLE_MIN = 10;

/**
 * `render(names)` 로 제목을 만들되, 80자에 들어가는 가장 이름 많은 형태를 고른다.
 *
 * @param names  대표 이름 후보 (앞쪽이 더 중요한 순서)
 * @param render 이름 배열 → 제목. 빈 배열도 **반드시** 유효한 제목을 내야 한다.
 * @param maxNames 최대 몇 개까지 넣어볼지
 */
export function fitTitle(
  names: string[],
  render: (picked: string[]) => string,
  maxNames = 3,
): string {
  const pool = names.filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
  const start = Math.min(maxNames, pool.length);

  for (let n = start; n >= 1; n--) {
    const t = render(pool.slice(0, n));
    if (t.length <= TITLE_MAX) return t;
  }

  // 이름 없이도 안 들어가면 자른다. ⚠️ 자르고도 10자 미만이면 트리거가 또 막으므로
  //    호출부가 최소 길이를 보장하는 문구를 쓰게 되어 있다.
  const bare = render([]);
  return bare.length <= TITLE_MAX ? bare : bare.slice(0, TITLE_MAX);
}
