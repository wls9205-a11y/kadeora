// 히어로 이미지 라이선스 판정.
//
// ── 왜 필요한가 ──
// 「광고 랜딩에서는 라이선스 미확인 이미지를 빼자」는 규칙이 있었는데
// **강제하는 코드가 한 줄도 없었다.** hero_image_license 에 문장을 적어 두기만 하고
// 읽는 곳이 없었다(실측 grep 0건). 부산 조감도 174장이 「공공누리 확인 필요」 표기를 단 채
// 리드폼이 뜨는 현장에 그대로 나가고 있었다.
//
// ⚠️ **별도 광고 랜딩 라우트가 없다.** 리드폼이 붙은 `/apt/[id]` 상세가 곧 광고 랜딩이다.
//    그래서 "광고에서 뺀다" = "리드폼이 뜨는 현장에서 뺀다" 로 구현된다.
//
// ── 왜 이 정도로 보수적인가 ──
// 네이버 심사 반려 한 번이면 광고 계정 전체가 묶인다. 조감도 174장보다 계정이 크다.
// 확인 안 된 이미지로 광고를 태우는 쪽이 훨씬 비싼 실수다.

import { isLeadEligible } from '@/lib/apt/lead-eligibility';

/**
 * `apt_sites.hero_license_tier` 의 코드값.
 *
 * ⚠️ 자유 문장이 아니라 코드값이다. 문장으로는 판정이 안 돼서 DB 담당이 컬럼을 갈랐다.
 *    원문은 `hero_license_note` 에 보존돼 있다. CHECK 제약이 걸려 있다.
 */
export type HeroLicenseTier = 'confirmed' | 'review' | 'blocked';

/**
 * 이 히어로 이미지를 이 화면에서 써도 되는가.
 *
 *   confirmed  공공누리 유형 확인됨 · 시행사 게재 허락 · 시공사 공식 사이트 → 어디서나
 *   review     확인 필요(부산 174건 · 서울 정보몽땅 수집분)
 *              → 목록·검색·비리드 페이지에서는 쓰고, **리드폼이 뜨는 현장에서만** 뺀다
 *   blocked    출처 불명 → 어디서도 쓰지 않는다
 *   null       아직 판정 전. **review 와 같이 다룬다** — 모르는 걸 confirmed 로 올리지 않는다
 *
 * ⚠️ 마지막 줄이 핵심이다. 새로 들어오는 이미지는 tier 가 비어 있을 수 있는데,
 *    비었다고 통과시키면 이 게이트가 있으나 마나가 된다.
 */
export function canUseHeroImage(opts: {
  tier?: string | null;
  lifecycleStage?: string | null;
  /** 이 화면에 리드폼이 뜨는가. 안 넘기면 단계로 판정한다. */
  leadContext?: boolean;
}): boolean {
  const tier = (opts.tier ?? '').trim();
  if (tier === 'blocked') return false;
  if (tier === 'confirmed') return true;

  // review · 그리고 판정 전(null·빈값·모르는 값)
  const isAd = opts.leadContext ?? isLeadEligible(opts.lifecycleStage);
  return !isAd;
}
