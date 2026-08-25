/**
 * 부울경(부산·울산·경남) 판정 — «단일 원본».
 *
 * [패치 P5 §2] 지금까지 부울경 판정 정규식이 코드 여러 곳에 흩어져 있었다.
 *   화면·크론·어드민이 각자 조금씩 다른 목록을 들고 있으면 «같은 글이 어디서는
 *   부울경, 어디서는 아님» 이 된다. 배분 쿼터를 거는 순간 그 불일치가 그대로
 *   비율 오차가 되므로 여기 한 곳으로 모은다.
 *
 * ⚠️ 두 종류의 판정을 «구분» 한다.
 *   - isBuulgyeongRegion : region 컬럼처럼 «시·도 값이 이미 있는» 경우. 정확하다.
 *   - matchesBuulgyeongText : 제목·본문처럼 «글자만 있는» 경우. 어림짐작이다.
 *   전자를 쓸 수 있으면 전자를 쓴다. 후자는 오탐이 있다(아래 주의).
 */

import { SIGUNGU_MAP } from '@/lib/regions';

/** 시·도 3개. apt_sites.region · v_apt_sigungu_count.region 이 이 값을 쓴다. */
export const BUULGYEONG_REGIONS = ['부산', '울산', '경남'] as const;
export type BuulgyeongRegion = (typeof BUULGYEONG_REGIONS)[number];

const BUULGYEONG_REGION_SET: ReadonlySet<string> = new Set(BUULGYEONG_REGIONS);

/** region 값이 부울경인가. 정확 판정. */
export function isBuulgyeongRegion(region?: string | null): boolean {
  return !!region && BUULGYEONG_REGION_SET.has(region.trim());
}

/** 부울경 시군구 전체 (부산 16 · 울산 5 · 경남 18). regions.ts 를 단일 원본으로 둔다. */
export const BUULGYEONG_SIGUNGU: readonly string[] = BUULGYEONG_REGIONS.flatMap(
  (r) => SIGUNGU_MAP[r] ?? [],
);

/**
 * 글자 판정용 지명.
 *
 * ⚠️ «남구·동구·북구·중구·서구» 는 «일부러 뺐다».
 *    부산·울산에도 있지만 광주·대구·인천·대전에도 있어서, 그 이름만으로는
 *    부울경이라고 말할 수 없다. 넣으면 전국 글이 부울경으로 잡혀 쿼터가
 *    «달성된 것처럼» 보인다 — 지표를 스스로 속이는 쪽이 가장 나쁘다.
 *    시·도명이 함께 있으면 어차피 아래 REGION 패턴에 걸린다.
 */
const AMBIGUOUS_SIGUNGU = new Set(['남구', '동구', '북구', '중구', '서구']);

const DISTINCT_SIGUNGU = BUULGYEONG_SIGUNGU.filter((s) => !AMBIGUOUS_SIGUNGU.has(s));

/** '해운대구' → '해운대' 처럼 접미사 없이 쓰는 표기도 잡는다. */
const SIGUNGU_STEMS = DISTINCT_SIGUNGU.map((s) => s.replace(/(시|군|구)$/, ''))
  .filter((s) => s.length >= 2);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 제목·본문에서 부울경을 찾는 정규식.
 * 시·도명 + 모호하지 않은 시군구 + 그 어간.
 */
export const BUULGYEONG_TEXT_RE = new RegExp(
  [...BUULGYEONG_REGIONS, ...DISTINCT_SIGUNGU, ...SIGUNGU_STEMS]
    .map(escape)
    .sort((a, b) => b.length - a.length) // 긴 것 먼저 — '창원시' 가 '창원' 보다 앞
    .join('|'),
);

/** 글자에 부울경 지명이 있는가. 어림짐작이므로 region 값이 있으면 그쪽을 쓸 것. */
export function matchesBuulgyeongText(...texts: Array<string | null | undefined>): boolean {
  return BUULGYEONG_TEXT_RE.test(texts.filter(Boolean).join(' '));
}

/**
 * 부울경 여부를 «있는 정보 중 가장 정확한 것» 으로 판정한다.
 * region 이 있으면 그것만 믿고, 없을 때만 글자로 내려간다.
 */
export function isBuulgyeong(input: {
  region?: string | null;
  title?: string | null;
  text?: string | null;
}): boolean {
  if (input.region != null && input.region !== '') return isBuulgyeongRegion(input.region);
  return matchesBuulgyeongText(input.title, input.text);
}
