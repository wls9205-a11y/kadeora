// 한국어 조사 처리.
//
// ⚠️ 자동 생성 문장에 이름을 그대로 이어붙이면 받침에 따라 조사가 갈린다. 실측:
//    「시공사로는 … 한국토지주택공사이 참여하고 있습니다」  ← `공사`(받침 없음)라 `가` 가 맞다
//    「… 포스코이앤씨이 참여하고」                          ← `씨` 라 `가` 가 맞다
//    글 한 편에 수십 개 이름이 들어가는 크론이라 눈으로는 못 잡는다.

/** 마지막 글자에 받침이 있는가. 한글이 아니면 null — 모르면 지어내지 않는다. */
export function hasFinalConsonant(word: string): boolean | null {
  const s = (word ?? '').trim();
  if (!s) return null;
  const code = s.charCodeAt(s.length - 1);
  // 한글 음절 U+AC00 ~ U+D7A3
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

/**
 * 조사쌍. 앞이 **받침 있을 때** 쓰는 것을 먼저 둔다.
 * `은/는` · `이/가` · `을/를` · `과/와` · `으로/로`
 */
const PAIRS = {
  '은/는': ['은', '는'],
  '이/가': ['이', '가'],
  '을/를': ['을', '를'],
  '과/와': ['과', '와'],
  '으로/로': ['으로', '로'],
} as const;

export type JosaPair = keyof typeof PAIRS;

/**
 * 이름 뒤에 붙일 조사를 고른다.
 *
 * ⚠️ 한글이 아니거나 판정이 안 되면 **받침 있는 쪽**으로 떨어진다.
 *    `SK이앤씨` 같은 값에서 틀릴 수 있지만, 둘 중 하나는 골라야 하고
 *    받침 쪽이 어색함이 덜하다. 확실하지 않으면 아래 josaSafe 로 문장을 바꿔 쓸 것.
 */
export function josa(word: string, pair: JosaPair): string {
  const [withBatchim, withoutBatchim] = PAIRS[pair];
  return hasFinalConsonant(word) === false ? withoutBatchim : withBatchim;
}

/** 이름 + 조사. `withJosa('현대건설', '이/가')` → `현대건설이` */
export function withJosa(word: string, pair: JosaPair): string {
  return `${word}${josa(word, pair)}`;
}
