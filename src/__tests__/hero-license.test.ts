// 히어로 이미지 라이선스 게이트.
//
// ⚠️ 이 규칙은 「표기만 하고 아무 일도 안 하던」 상태를 고친 것이다.
//    hero_image_license 에 문장을 적어 뒀지만 읽는 코드가 0줄이었고,
//    「공공누리 확인 필요」 조감도 174장이 리드폼 현장에 그대로 나가고 있었다.
//    네이버 심사 반려 한 번이면 광고 계정 전체가 묶인다 — 조감도보다 계정이 크다.

import { describe, it, expect } from 'vitest';
import { canUseHeroImage } from '@/lib/apt/hero-license';

// 리드폼이 뜨는 단계 / 안 뜨는 단계
const AD = 'plan_approved';       // 정비사업 — 리드폼 대상
const NOT_AD = 'post_move_in';    // 입주 후 — 리드폼 없음

describe('canUseHeroImage', () => {
  it('confirmed 는 어디서나 쓴다', () => {
    expect(canUseHeroImage({ tier: 'confirmed', lifecycleStage: AD })).toBe(true);
    expect(canUseHeroImage({ tier: 'confirmed', lifecycleStage: NOT_AD })).toBe(true);
  });

  it('blocked 는 어디서도 쓰지 않는다', () => {
    expect(canUseHeroImage({ tier: 'blocked', lifecycleStage: AD })).toBe(false);
    expect(canUseHeroImage({ tier: 'blocked', lifecycleStage: NOT_AD })).toBe(false);
  });

  it('review 는 리드폼 현장에서만 뺀다 — 목록·검색에서는 쓴다', () => {
    expect(canUseHeroImage({ tier: 'review', lifecycleStage: AD })).toBe(false);
    expect(canUseHeroImage({ tier: 'review', lifecycleStage: NOT_AD })).toBe(true);
  });

  it('🔴 판정 전(null·빈값·모르는 값)은 review 와 같이 다룬다', () => {
    // 비었다고 통과시키면 게이트가 있으나 마나가 된다.
    // 새로 수집되는 이미지는 tier 가 비어 있을 수 있다.
    expect(canUseHeroImage({ tier: null, lifecycleStage: AD })).toBe(false);
    expect(canUseHeroImage({ tier: '', lifecycleStage: AD })).toBe(false);
    expect(canUseHeroImage({ tier: 'unknown_value', lifecycleStage: AD })).toBe(false);
    expect(canUseHeroImage({ lifecycleStage: AD })).toBe(false);
  });

  it('leadContext 를 직접 넘기면 단계보다 우선한다', () => {
    // 목록 카드처럼 단계와 무관하게 "여긴 광고 자리가 아니다" 를 명시할 수 있어야 한다.
    expect(canUseHeroImage({ tier: 'review', lifecycleStage: AD, leadContext: false })).toBe(true);
    expect(canUseHeroImage({ tier: 'review', lifecycleStage: NOT_AD, leadContext: true })).toBe(false);
  });
});
