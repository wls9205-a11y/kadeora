// v3 — 현장 상세(/apt/{slug}) 라우트 판별.
//
// StickySignupBar(커밋 2) 와 StickyTalkBanner(커밋 6) 가 같이 쓴다.
// 두 곳 모두 "현장 상세에서만" 꺼져야 하는데, startsWith('/apt/') 로 잡으면
// /apt/busan · /apt/map 같은 허브까지 전부 죽는다.

/** /apt 아래 단일 세그먼트 라우트 중 현장 상세가 아닌 것들. */
const RESERVED = new Set([
  'area','big-events','builder','busan','compare','complex','data','diagnose',
  'feed','landmark','map','popular','ranking','redev','region','search',
  'sites','stage','theme','unsold','unsold-deals',
]);

/**
 * '/apt/엄궁역-트라비스-하늘채' → true, '/apt/busan' → false, '/apt' → false
 *
 * 주의: /apt 아래 새 라우트를 추가하면 위 RESERVED 에도 넣어야 한다.
 * 안 넣으면 그 허브에서 카톡 배너가 꺼진다.
 */
export function isAptSiteDetailPath(pathname: string): boolean {
  const m = /^\/apt\/([^/]+)\/?$/.exec(pathname);
  return !!m && !RESERVED.has(decodeURIComponent(m[1]));
}
