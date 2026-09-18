// BN-1 ② — 판독 모드 글감 판별. BP 는 기존 규칙 그대로(사유 도장 없음), BN 은 사유 도장.
import { describe, it, expect } from 'vitest';
import { reviewHoldOf, isReviewHoldReason, reviewSwitches } from '@/lib/content/review-hold';

describe('reviewHoldOf', () => {
  it('BP 글감 두 형태 — 도장 없음(해제 절차 불변)', () => {
    expect(reviewHoldOf({ source_type: 'bp70_hub' })).toEqual({ namespace: 'bp', reason: 'hold:bp_review', stampReason: false });
    expect(reviewHoldOf({ source_type: 'cvn', raw_data: { doc: 'BP70-우동3' } })?.namespace).toBe('bp');
  });
  it('BN 글감 — 도장', () => {
    expect(reviewHoldOf({ source_type: 'bn_hub' })).toEqual({ namespace: 'bn', reason: 'hold:bn_review', stampReason: true });
  });
  it('일반 글감은 판독 모드가 아니다', () => {
    expect(reviewHoldOf({ source_type: 'news' })).toBeNull();
    expect(reviewHoldOf({})).toBeNull();
  });
});

describe('isReviewHoldReason', () => {
  it('판독 대기 사유만 참', () => {
    expect(isReviewHoldReason('hold:bp_review')).toBe(true);
    expect(isReviewHoldReason('hold:bn_review')).toBe(true);
    expect(isReviewHoldReason('hold:bn_20260918_footer_contam_replace_by_new')).toBe(false);
    expect(isReviewHoldReason('hallucination_disposition_20260915')).toBe(false);
    expect(isReviewHoldReason(null)).toBe(false);
  });
});

describe('reviewSwitches', () => {
  const sb = (rows: any[]) => ({ from: () => ({ select: () => ({ in: () => ({ eq: async () => ({ data: rows }) }) }) }) });
  it('행이 없으면 닫힘', async () => {
    expect(await reviewSwitches(sb([]))).toEqual({ bp: false, bn: false });
  });
  it('정확히 true 만 열림', async () => {
    expect(await reviewSwitches(sb([{ namespace: 'bn', value: true }, { namespace: 'bp', value: 'true' }]))).toEqual({ bp: false, bn: true });
  });
});
