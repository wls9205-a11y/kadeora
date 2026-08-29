// M5 §A — 기축 폼 판정 자물쇠.
//
// ⚠️ 이 파일이 지키는 것 둘:
//   1. isLeadEligible() 의 «반환값이 그대로다». 블로그 하단(P1)·blog-safe-insert·
//      hero-license 가 같은 판정을 쓴다. 바뀌면 기축 블로그 글에 분양 문구 폼이 붙고
//      canUseHeroImage 의 광고 게이트까지 흔들린다.
//   2. 기축에 «분양 문구» 가 붙지 않는다.

import { describe, it, expect } from 'vitest';
import { isLeadEligible, leadKind, LEAD_ELIGIBLE_STAGES, RESALE_STAGES } from '@/lib/apt/lead-eligibility';
import { leadCopy, leadCopyKind } from '@/lib/apt/lead-copy';

describe('isLeadEligible — 반환값 회귀 방어 (M5 §F-3)', () => {
  it('기축 단계는 여전히 false 다', () => {
    for (const s of ['post_move_in', 'landmark_active', 'active_trade']) {
      expect(isLeadEligible(s)).toBe(false);
    }
  });

  /**
   * ⚠️ 예전에는 `toHaveLength(13)` 이었다. H6-1(82e85a50)이 `award_pending` 을 더해
   *    14가 됐는데 이 숫자를 안 고쳐서 «빨간불인 채로» 커밋됐다.
   *    숫자만 세면 두 가지를 못 잡는다 — 무엇이 늘었는지, 무엇이 «바뀌치기» 됐는지.
   *    그래서 목록째 박는다. 단계를 더하거나 빼려면 여기도 «의도적으로» 고쳐야 한다.
   */
  it('분양 단계 목록이 그대로다', () => {
    expect([...LEAD_ELIGIBLE_STAGES]).toEqual([
      'site_planning',
      'pre_announcement',
      'subscription_open',
      'award_pending', // H6-1 — 접수 마감·발표 전. 예비·미계약 물량이 남아 관심 등록이 유효하다
      'award_announced',
      'unsold_active',
      'move_in_ready',
      'move_in_started',
      // ONESHOT §C0 — 정비사업 6단계
      'union_established',
      'constructor_selected',
      'plan_approved',
      'mgmt_approved',
      'construction',
      'contract_signing',
    ]);
    for (const s of LEAD_ELIGIBLE_STAGES) expect(isLeadEligible(s)).toBe(true);
  });

  it('빈 값은 false', () => {
    for (const s of [null, undefined, '']) expect(isLeadEligible(s as string | null)).toBe(false);
  });
});

describe('leadKind — 폼을 붙일지, 어떤 폼인지', () => {
  it('분양 13단계 → presale', () => {
    for (const s of LEAD_ELIGIBLE_STAGES) expect(leadKind(s)).toBe('presale');
  });

  it('post_move_in · landmark_active → resale', () => {
    for (const s of RESALE_STAGES) expect(leadKind(s)).toBe('resale');
  });

  it('그 외는 null — 폼을 붙이지 않는다', () => {
    for (const s of ['active_trade', 'unknown_stage']) expect(leadKind(s)).toBeNull();
  });

  it('lifecycle_stage 가 비면 null — 추정해 채우지 않는다 (§F-21)', () => {
    for (const s of [null, undefined, '']) expect(leadKind(s)).toBeNull();
  });

  it('presale 과 resale 은 겹치지 않는다', () => {
    for (const s of RESALE_STAGES) {
      expect((LEAD_ELIGIBLE_STAGES as readonly string[]).includes(s)).toBe(false);
    }
  });
});

describe('문구 — 기축에 분양 문구를 재사용하지 않는다 (§F-5)', () => {
  it('기축은 resale 계열이다', () => {
    for (const s of RESALE_STAGES) expect(leadCopyKind(s)).toBe('resale');
  });

  it('기축 문구에 분양·모집공고·청약이 없다', () => {
    for (const s of RESALE_STAGES) {
      const c = leadCopy(s, '더샵 남양산센텀포레');
      const all = `${c.band} ${c.cta} ${c.lede} ${c.button ?? ''}`;
      for (const banned of ['분양', '모집공고', '청약', '잔여세대']) {
        expect(all).not.toContain(banned);
      }
    }
  });

  it('inquiry_type 이 매물상담이다 — 폼 종류를 가르는 유일한 값', () => {
    for (const s of RESALE_STAGES) expect(leadCopy(s).inquiryType).toBe('매물상담');
  });

  it('분양 단계는 문구가 그대로다 — 회귀 방어', () => {
    expect(leadCopy('move_in_ready').inquiryType).toBe('분양상담');
    expect(leadCopy('union_established').inquiryType).toBe('진행상황알림');
  });

  it('버튼은 제목과 다르게 쓸 수 있고, 기존 계열은 미지정이라 그대로다', () => {
    expect(leadCopy('post_move_in').button).toBe('상담 신청');
    expect(leadCopy('post_move_in').cta).toBe('이 단지 매물·시세 상담');
    expect(leadCopy('move_in_ready').button).toBeUndefined();
  });
});
