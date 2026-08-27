/**
 * H5-2 — 「마지막에 본 지역」 쿠키 한 곳.
 *
 * ── 왜 한 파일인가 ──────────────────────────────────────────────────────────
 * 부동산 탭과 블로그 탭이 «같은 지역 상태» 를 공유한다. 이름·수명·SameSite 가
 * 두 곳에서 갈리면 한쪽이 쓴 값을 다른 쪽이 못 읽는다. 여기서만 정한다.
 *
 * ⚠️ httpOnly 가 아니다. 클라이언트 칩에서도 읽고 쓰기 때문이다.
 *    그래서 «민감한 것을 담지 않는다» — 값은 시도 라벨 문자열 하나뿐이다.
 */

import { REGION_BBOX } from '@/lib/geo/region-bbox';

export const REGION_COOKIE = 'kd_region';
export const REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년

/** 위치도 쿠키도 없을 때. 크론 수집 비중이 가장 큰 지역이다. */
export const REGION_FALLBACK = '부산';

/** 화면에 쓰는 17 시도. `region-bbox.ts` 가 정본이다 — 목록을 두 벌 만들지 않는다. */
export const SIDO_LIST: string[] = Object.keys(REGION_BBOX);

/**
 * 쿠키/쿼리에서 온 값을 «믿지 않고» 검증한다.
 * 목록에 없으면 null — 임의 문자열이 그대로 화면 카피와 쿼리에 들어가면 안 된다.
 */
export function normalizeSido(v: string | null | undefined): string | null {
  const s = (v || '').trim();
  if (!s) return null;
  return SIDO_LIST.includes(s) ? s : null;
}

/**
 * 표시할 지역을 정한다. **우선순위가 이 함수의 전부다.**
 *
 *   ?region=  >  쿠키  >  (호출부의 위치 추정)  >  부산
 *
 * ⚠️ 쿠키가 위치 추정을 «이긴다». 사용자가 직접 고른 것이 자동 추정보다 세다 —
 *    고른 지역이 다음 방문에 말없이 바뀌면 그건 고장으로 읽힌다.
 */
export function resolveRegion(opts: {
  query?: string | null;
  cookie?: string | null;
}): { region: string; source: 'query' | 'cookie' | 'fallback' } {
  const q = normalizeSido(opts.query);
  if (q) return { region: q, source: 'query' };
  const c = normalizeSido(opts.cookie);
  if (c) return { region: c, source: 'cookie' };
  return { region: REGION_FALLBACK, source: 'fallback' };
}

/** 클라이언트에서 쿠키를 쓴다. 값이 목록에 없으면 «아무것도 하지 않는다». */
export function writeRegionCookie(region: string): void {
  if (typeof document === 'undefined') return;
  const v = normalizeSido(region);
  if (!v) return;
  document.cookie =
    `${REGION_COOKIE}=${encodeURIComponent(v)}; path=/; max-age=${REGION_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** 클라이언트에서 쿠키를 읽는다. */
export function readRegionCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${REGION_COOKIE}=([^;]*)`));
  if (!m) return null;
  try {
    return normalizeSido(decodeURIComponent(m[1]));
  } catch {
    return null;
  }
}
