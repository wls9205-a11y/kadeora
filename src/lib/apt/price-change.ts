// 1년 가격 변동률 표기 — «평형 없는 %를 못 쓰게» 한 곳에서 막는다.
//
// ── 왜 이 파일이 있는가 ──
// `price_change_1y` 는 원래 `GROUP BY t.apt_name` 하나로 만들어졌다. 평형도 시군구도 없었다.
// 두 가지가 동시에 망가져 있었다:
//
//   ① 평형 미고정 — 평형 구성이 바뀌면 그게 가격 변동으로 위장된다.
//      실측(e편한세상송도더퍼스트비치 · 부산 서구) 5월→6월:
//        단지 전체 평균 4.78→5.34억(+11.7%) 인데 84㎡ +0.7% · 59㎡ −3.4%.
//        움직인 건 84㎡ 비중 38%→60% 뿐이었다.
//      부울경 (단지,평형) 586 계열 중 140건(23.9%)에서 부호가 실제로 뒤집혔다.
//   ② 시군구 미포함 — 같은 이름의 «다른 도시 단지» 가 한 평균에 섞였다.
//      이름 1,833개가 복수 시군구에 걸쳐 있고(최대 81곳), 거래 160,525행 = 전체의 22%.
//
// DB 쪽에서 `calc_apt_price_change_1y()` 를 `GROUP BY apt_name, sigungu, exclusive_area` 로
// 고치고 대표 평형 하나를 골라 주도록 바꿨다. 그리고 근거 3개를 같이 저장한다:
//   `price_change_area`(㎡) · `price_change_n_recent` · `price_change_n_past`
//
// ⚠️ **화면에서 %만 떼어 쓰지 말 것.** 평형이 안 붙은 %는 「단지 전체가 그만큼 올랐다」로
//    읽히고, 그게 위 ①이 만든 바로 그 오독이다. 그래서 이 파일은 % 만 내는 함수를
//    «제공하지 않는다» — 나가는 문자열에는 항상 평형이 들어 있다.
//
// ⚠️ 표본 수가 적다(최소 2건). 근거를 밝히지 않으면 2건짜리 변동률이 시세처럼 읽힌다.

export interface PriceChangeFields {
  price_change_1y?: number | string | null;
  price_change_area?: number | string | null;
  price_change_n_recent?: number | string | null;
  price_change_n_past?: number | string | null;
}

/** `apt_complex_profiles` 에서 이 네 컬럼을 «같이» 읽어야 한다. 하나라도 빠지면 렌더할 수 없다. */
export const PRICE_CHANGE_COLS =
  'price_change_1y, price_change_area, price_change_n_recent, price_change_n_past';

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 이 행의 변동률을 화면에 낼 수 있는가.
 *
 * ⚠️ 네 값이 «전부» 있어야 참이다. 실측상 DB 는 이 불변식을 지킨다
 *    (price_change_1y 가 있는 6,076행 중 area·표본이 빠진 행 0건).
 *    그래도 여기서 다시 확인하는 이유는, 이 게이트가 뚫리면 평형 없는 %가 나가기 때문이다.
 */
export function canShowPriceChange(p: PriceChangeFields | null | undefined): boolean {
  if (!p) return false;
  const pct = num(p.price_change_1y);
  const area = num(p.price_change_area);
  const nr = num(p.price_change_n_recent);
  const np = num(p.price_change_n_past);
  return pct !== null && area !== null && area > 0 && nr !== null && nr > 0 && np !== null && np > 0;
}

/** `84.9` → `85㎡`. */
export function pcArea(p: PriceChangeFields): string {
  const a = num(p.price_change_area);
  return a && a > 0 ? `${Math.round(a)}㎡` : '';
}

/** `+3.2%` / `-1.4%`. **단독으로 쓰지 말 것** — 아래 두 함수를 통해서만 나간다. */
function pct(p: PriceChangeFields): string {
  const v = num(p.price_change_1y);
  if (v === null) return '';
  return `${v > 0 ? '+' : ''}${v}%`;
}

/**
 * 좁은 자리(표 칸·사이드바)용. 평형이 «붙은» 짧은 형태.
 *   `+3.2% · 85㎡`
 */
export function priceChangeCompact(p: PriceChangeFields): string {
  if (!canShowPriceChange(p)) return '';
  return `${pct(p)} · ${pcArea(p)}`;
}

/**
 * 문장용. 근거(평형·표본)까지 밝힌다.
 *   `85㎡ 기준 최근 1년 +3.2% (최근 12건 · 1년 전 7건)`
 *
 * ⚠️ 「단지가 +3.2% 올랐다」로 쓰지 말 것. 오르내린 건 «그 평형» 이다.
 */
export function priceChangeSentence(p: PriceChangeFields): string {
  if (!canShowPriceChange(p)) return '';
  const nr = num(p.price_change_n_recent);
  const np = num(p.price_change_n_past);
  return `${pcArea(p)} 기준 최근 1년 ${pct(p)} (최근 ${nr}건 · 1년 전 ${np}건)`;
}

/**
 * «순위 목록» 용. 평형에 더해 표본 수까지 붙인다.
 *   `+38.5% · 125㎡ · 2건`
 *
 * ⚠️ 왜 목록에서만 표본을 밝히는가 — 목록은 이 값으로 «정렬» 하기 때문이다.
 *    최소 표본이 2건이라, 변동률 순으로 세우면 «가장 시끄러운 추정치가 맨 위» 로 온다.
 *    실측: 부울경 상위 1위가 `구포유림노르웨이숲2차` +38.5% 인데 최근 2건 대 과거 2건이다.
 *    표본을 안 적으면 그 2건짜리 숫자가 목록의 대표값처럼 읽힌다.
 */
export function priceChangeListLabel(p: PriceChangeFields): string {
  if (!canShowPriceChange(p)) return '';
  const nr = num(p.price_change_n_recent);
  return `${pct(p)} · ${pcArea(p)} · ${nr}건`;
}

/** 상승/하락/보합. 색을 고르는 데 쓴다. 값이 없으면 null. */
export function priceChangeDirection(p: PriceChangeFields): 'up' | 'down' | 'flat' | null {
  if (!canShowPriceChange(p)) return null;
  const v = num(p.price_change_1y) as number;
  return v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
}
