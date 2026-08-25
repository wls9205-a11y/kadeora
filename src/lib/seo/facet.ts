import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { REGIONS, SIGUNGU_MAP } from '@/lib/regions';

/**
 * [§6] 파셋(필터 조합) URL 색인 차단 — canonical 이 아니라 noindex 메타로.
 *
 * 배경(2026-08-25 네이버 노출 실측):
 *   kadeora.app 노출 200건 중 31.5%(63건)가 개별 글이 아니라 허브·파셋 URL이었다.
 *   `/blog/series/*` 32건, `/blog?tag=`·`?sort=` 31건이 개별 글 자리를 먹고 있었다.
 *
 * 원인:
 *   이 페이지들이 `robots: index,follow` + `canonical: /blog` 로 나가는데
 *   **네이버 Yeti 는 rel=canonical 을 사실상 무시하고 noindex 메타만 따른다.**
 *   robots.txt 의 `Disallow: /*?sort=` 도 무력했다 — `?sort=popular` 가 실제로
 *   색인돼 있는 것이 증거다(Yeti 와일드카드 지원 불안정).
 *
 * 그래서:
 *   1) canonical 에 의존하지 말고 noindex 메타를 직접 내보낸다.
 *   2) robots.txt Disallow 로 크롤을 막지 않는다 — 크롤을 막으면 Yeti 가
 *      noindex 를 읽지 못해 URL 만 색인되는 더 나쁜 상태가 된다.
 *   3) 색인시킬 지역 허브는 파라미터가 아니라 경로로 만든다(`/apt/region/*`, `/apt/area/*`).
 *
 * 주의 — 판정은 **허용목록(allowlist) 이 아니라 차단 기본값**이다.
 *   `?tag=` 는 /blog 의 searchParams 타입에 있지도 않은 미지의 파라미터였는데
 *   그래서 아무 조건에도 안 걸리고 그대로 색인됐다. 알려진 파라미터만 막으면
 *   다음에 새 파라미터가 생길 때 같은 사고가 반복된다.
 */

/** 값이 이것과 같으면 파셋이 아니라 기본 상태로 본다(= 정규 URL과 동일한 화면). */
const CANONICAL_DEFAULTS: Record<string, string> = {
  page: '1',
  category: 'all',
  sort: 'latest',
  tab: 'all',
};

type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

/**
 * 쿼리 파라미터가 하나라도 «기본값이 아닌» 값으로 붙어 있으면 파셋 URL이다.
 * 알려진 키만 보지 않고 들어온 키 전부를 본다.
 */
export function isFacetUrl(sp: SP | undefined, extraDefaults?: Record<string, string>): boolean {
  if (!sp) return false;
  const defaults = { ...CANONICAL_DEFAULTS, ...(extraDefaults || {}) };
  return Object.entries(sp).some(([k, v]) => {
    const val = first(v);
    if (!val) return false;
    return defaults[k] !== val;
  });
}

/** 파셋이면 noindex,follow. 아니면 undefined(호출부에서 스프레드로 무시됨). */
export function facetRobots(
  sp: SP | undefined,
  extraDefaults?: Record<string, string>,
): Pick<Metadata, 'robots'> {
  return isFacetUrl(sp, extraDefaults) ? { robots: { index: false, follow: true } } : {};
}

/**
 * `/apt` 필터 파라미터를 «색인 자산인 경로형 허브»로 되돌린다.
 * 파셋 자체는 noindex 로 나가지만, canonical 은 대응하는 경로 허브를 가리켜
 * 링크 가치를 그쪽으로 모은다. 대응 경로가 없으면 정규 `/apt`.
 *
 * 실제 파라미터명은 `?region=` · `?sgg=` · `?st=` 다(지시서의 `?sigungu=`·`?status=` 아님).
 */
export function aptFacetCanonical(sp: { region?: string; sgg?: string; st?: string } | undefined): string {
  const region = sp?.region?.trim();
  const sgg = sp?.sgg?.trim();
  if (region && (REGIONS as readonly string[]).includes(region)) {
    if (sgg && (SIGUNGU_MAP[region] || []).includes(sgg)) {
      return `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sgg)}`;
    }
    return `${SITE_URL}/apt/region/${encodeURIComponent(region)}`;
  }
  return `${SITE_URL}/apt`;
}
