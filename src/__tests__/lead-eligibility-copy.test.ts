// ONESHOT §C0 · §C-1 — 리드폼 노출 단계 + 단계별 문구 회귀 테스트.
//
// 지키려는 것 둘.
//   ① **유입이 나는 정비사업 현장이 리드를 받을 수 있어야 한다.**
//      `울산 남구 달동 재개발`(조합설립)은 네이버 유입 48건에 CTA 완료 1건이 난 페이지인데
//      폼이 없었다. 그 단계가 목록에서 빠져 있었기 때문이다.
//   ② **기축에는 폼이 붙으면 안 된다.** 준공 20~30년 지난 단지에 분양 상담을 붙일 수 없다.

import { describe, expect, it } from 'vitest';
import { LEAD_ELIGIBLE_STAGES, isLeadEligible } from '@/lib/apt/lead-eligibility';
import { leadCopy, leadCopyKind } from '@/lib/apt/lead-copy';

/** 실측 2026-08-24 — 폼이 없어 리드를 못 받던 단계들. */
const REDEV_STAGES = [
  'union_established',
  'constructor_selected',
  'plan_approved',
  'mgmt_approved',
  'construction',
  'contract_signing',
];

/** 준공된 기축. 여기에 폼을 붙이면 안 된다. */
const EXISTING_STAGES = ['post_move_in', 'active_trade', 'landmark_active'];

describe('§C0 — 정비사업 단계에 폼이 뜬다', () => {
  it('6단계가 전부 대상이다', () => {
    for (const s of REDEV_STAGES) expect(isLeadEligible(s), s).toBe(true);
  });

  it('울산 남구 달동 재개발(조합설립)이 폼을 받는다 — 이게 이 작업의 이유다', () => {
    expect(isLeadEligible('union_established')).toBe(true);
  });

  it('기존 7단계도 그대로 유지된다 — 잘 되던 걸 잃지 않는다', () => {
    for (const s of [
      'site_planning', 'pre_announcement', 'subscription_open',
      'award_announced', 'unsold_active', 'move_in_ready', 'move_in_started',
    ]) expect(isLeadEligible(s), s).toBe(true);
  });
});

describe('§C0-4 — 기축에는 붙이지 않는다', () => {
  it('post_move_in · active_trade · landmark_active 는 제외', () => {
    for (const s of EXISTING_STAGES) expect(isLeadEligible(s), s).toBe(false);
  });

  it('단계를 모르면(null) 폼을 띄우지 않는다', () => {
    expect(isLeadEligible(null)).toBe(false);
    expect(isLeadEligible(undefined)).toBe(false);
    expect(isLeadEligible('')).toBe(false);
  });

  it('목록에 기축이 섞여 들어오지 않았다', () => {
    for (const s of EXISTING_STAGES) {
      expect(LEAD_ELIGIBLE_STAGES as readonly string[]).not.toContain(s);
    }
  });
});

describe('§C-1 — 단계별 문구', () => {
  it('공고 전에는 분양이라는 말을 쓰지 않는다', () => {
    // 분양가도 일정도 없는데 '분양 정보 안내' 는 어색하다.
    for (const s of ['union_established', 'plan_approved', 'mgmt_approved', 'construction', 'site_planning', 'pre_announcement']) {
      const c = leadCopy(s);
      expect(leadCopyKind(s), s).toBe('pre_notice');
      expect(c.cta, s).toBe('이 구역 진행 상황 알림 받기');
      expect(c.cta.includes('분양'), s).toBe(false);
    }
  });

  it('분양 진행 단계는 기존 문구를 그대로 쓴다', () => {
    for (const s of ['subscription_open', 'award_announced', 'unsold_active', 'move_in_ready', 'contract_signing']) {
      expect(leadCopy(s).cta, s).toBe('분양 정보 안내 신청');
    }
  });

  it('기축은 이 단지가 아니라 지역 분양을 안내한다', () => {
    expect(leadCopy('post_move_in').cta).toBe('이 지역 분양 정보 안내 신청');
  });

  it('공고 전 문의는 분양상담과 구분된다 — 미처리 경보가 분양상담으로 좁히기 때문', () => {
    expect(leadCopy('union_established').inquiryType).toBe('진행상황알림');
    expect(leadCopy('subscription_open').inquiryType).toBe('분양상담');
  });

  it('밴드·본문이 비어 있지 않다', () => {
    for (const s of [...REDEV_STAGES, ...EXISTING_STAGES, 'subscription_open', null]) {
      const c = leadCopy(s);
      expect(c.band.length, String(s)).toBeGreaterThan(0);
      expect(c.lede.length, String(s)).toBeGreaterThan(0);
    }
  });
});
