// 마스터 §2 — 광고 랜딩에서 미확인 정보를 렌더하지 않는다.
//
// 왜: 리드폼이 붙은 페이지는 광고 성격이 명확하고, 네이버 검색광고 심사는
// 광고 문구와 랜딩 내용의 일치를 본다. 미확인 정보가 있으면 **표시·광고법** 문제로 직결된다.
// **심사 반려 한 번이면 계정이 묶인다.**
//
// ── 판정 기준을 유입 파라미터에만 걸지 않는 이유 ──
// 저장소 안에 광고 유입 판정이 없다. `resolveChannel()` 은 리드 엔드포인트(Apps Script)
// 쪽에 있고 서버 렌더 시점에는 쓸 수 없다. 유입 파라미터로만 가르면
// 심사자가 파라미터 없이 랜딩 URL 을 직접 열었을 때 미확인 정보가 그대로 보인다.
//
// 그래서 **리드폼이 뜨는 페이지는 전부** 광고 문맥으로 본다.
// 지시서의 근거("리드폼이 붙어 광고 성격이 명확하다")와 같은 선이고,
// 파라미터 유무와 무관하게 안전하다.
//
// ⚠️ 잃는 것은 작다. 실측 2026-08-24 — `apt_site_events` 99건 중 미확정 26건,
//    `apt_sites` 5,687건 중 미확정 27건. 그 대가로 심사 리스크를 0으로 만든다.

/** 네이버 검색광고 유입 파라미터. 있으면 확실한 광고 문맥이다. */
const AD_PARAMS = ['n_query', 'n_keyword', 'n_ad_group', 'n_campaign', 'n_rank', 'napm', 'n_media'];

export type SearchParamsLike = Record<string, string | string[] | undefined>;

/** 유입 파라미터로 본 광고 문맥. 리드폼 판정과 OR 로 묶어 쓴다. */
export function isAdTrafficContext(sp: SearchParamsLike | undefined): boolean {
  if (!sp) return false;
  const keys = Object.keys(sp).map((k) => k.toLowerCase());
  if (keys.some((k) => AD_PARAMS.includes(k))) return true;
  const src = sp.utm_source;
  const v = (Array.isArray(src) ? src[0] : src)?.toLowerCase() ?? '';
  return v.includes('naver');
}

/**
 * 미확인 정보를 숨겨야 하는가.
 *
 * @param leadEligible 리드폼이 뜨는 현장인가 (이것만으로도 광고 문맥으로 본다)
 * @param sp           요청 쿼리 — 유입 파라미터가 있으면 확실한 광고다
 */
export function shouldHideUnconfirmed(leadEligible: boolean, sp?: SearchParamsLike): boolean {
  return leadEligible || isAdTrafficContext(sp);
}

/**
 * 확정 등급인가.
 *
 * ⚠️ **`null` 을 확정으로 치지 않는다.** 실측에서 `confidence` 가 null 인 이벤트가 13건 있다
 *    (트리거가 현장의 null confidence 를 그대로 옮긴다). 등급을 모르는 것과
 *    고시·공시 원문으로 확인한 것은 다르다 — 광고 랜딩에서 그 둘을 같게 취급하면
 *    "확정" 이라고 표시한 근거가 없는 정보가 나간다.
 */
export function isConfirmed(confidence: string | null | undefined): boolean {
  return confidence === 'confirmed';
}
