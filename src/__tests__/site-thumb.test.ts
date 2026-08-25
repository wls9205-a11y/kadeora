// 목록 썸네일 판정 자물쇠 (H2-2).
//
// ⚠️ 이 파일이 지키는 것 하나: **브라우저에서 `/api/og-apt` 를 부르지 않는다.**
//    RPC 의 thumb_url 은 마지막 폴백이 생성 카드 URL 이고, 이미지 없는 현장이
//    5,933/6,033 이라 대부분이 그리로 떨어진다. 그대로 <img src> 에 박으면
//    한 화면에 satori 렌더가 그 수만큼 돈다.

import { describe, it, expect } from 'vitest';
import { pickThumbSrc } from '@/components/apt/SiteThumb';

const HERO = 'https://cdn.example.com/hero/abc.jpg';
const CARD_API = '/api/og-apt?slug=%EC%9E%AC%EC%86%A12-%EC%9E%AC%EA%B1%B4%EC%B6%95&ratio=1x1';
const BUILT_CARD = 'https://cdn.example.com/cards/abc.png';

describe('pickThumbSrc — 생성 카드 URL 은 부르지 않는다', () => {
  it('🔴 /api/og-apt 가 오면 빈 문자열 — CSS 로 그린다', () => {
    expect(pickThumbSrc({ thumbUrl: CARD_API, lifecycleStage: 'plan_approved' })).toBe('');
  });

  it('미리 구운 카드가 있으면 그건 쓴다 — HTTP 는 이미지 한 장뿐이다', () => {
    expect(
      pickThumbSrc({ thumbUrl: CARD_API, cardImageUrl: BUILT_CARD, lifecycleStage: 'plan_approved' }),
    ).toBe(BUILT_CARD);
  });
});

describe('pickThumbSrc — 라이선스', () => {
  it('confirmed 면 리드폼 현장에서도 쓴다', () => {
    expect(
      pickThumbSrc({ thumbUrl: HERO, heroLicenseTier: 'confirmed', lifecycleStage: 'plan_approved' }),
    ).toBe(HERO);
  });

  it('review 는 리드폼 문맥에서 뺀다', () => {
    expect(
      pickThumbSrc({
        thumbUrl: HERO,
        heroLicenseTier: 'review',
        lifecycleStage: 'plan_approved',
        leadContext: true,
      }),
    ).toBe('');
  });

  it('review 라도 목록(비리드)에서는 쓴다', () => {
    expect(
      pickThumbSrc({
        thumbUrl: HERO,
        heroLicenseTier: 'review',
        lifecycleStage: 'post_move_in',
        leadContext: false,
      }),
    ).toBe(HERO);
  });
});

describe('pickThumbSrc — 위성 사진', () => {
  const SAT = 'https://maps.example.com/satellite/xy.png';

  it('🔴 준공 전 현장에 위성을 깔지 않는다 — 없는 건물 자리가 보인다', () => {
    expect(
      pickThumbSrc({ thumbUrl: SAT, heroLicenseTier: 'confirmed', lifecycleStage: 'plan_approved' }),
    ).toBe('');
  });

  it('기축은 실물이 있어 위성이 정확하다', () => {
    for (const stage of ['post_move_in', 'active_trade', 'landmark_active']) {
      expect(
        pickThumbSrc({ thumbUrl: SAT, heroLicenseTier: 'confirmed', lifecycleStage: stage }),
      ).toBe(SAT);
    }
  });
});
