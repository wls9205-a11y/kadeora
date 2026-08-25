// M5 §B-4 — 홈 섹션 데이터 함정 자물쇠.
//
// 실측에서 나온 두 가지를 고정한다.
//   ① 지역 평균을 채워 넣은 «가짜 분양가» 가 124곳에 붙어 있다
//   ② 조회수 9위가 현장이 아니라 LH 공고문이다
//
// ⚠️ 광고 키워드 필터의 length>=6 을 여기 가져오면 안 된다 —
//    `레이카운티`(5자 · 조회수 3위) 같은 실존 대단지가 날아간다.

import { describe, it, expect } from 'vitest';
import { buildFakePriceSet, priceOf, isRealSite } from '@/lib/home/sections';

const row = (min: number | null, max: number | null, stage: string | null) => ({
  price_min: min, price_max: max, lifecycle_stage: stage,
});

describe('가짜 분양가 — 3곳 이상 AND 3단계 이상', () => {
  it('여러 단계에 걸친 같은 값은 채움값이다', () => {
    const rows = [
      row(20800, 55500, 'post_move_in'),
      row(20800, 55500, 'union_established'),
      row(20800, 55500, 'unsold_active'),
    ];
    expect(buildFakePriceSet(rows).has('20800|55500')).toBe(true);
  });

  it('단일 단계에 같은 값이면 실제 평균가일 수 있어 살린다', () => {
    // 실측: 11000~11000 이 post_move_in 9곳. 3곳 기준만 쓰면 311곳이 잘린다
    const rows = Array.from({ length: 9 }, () => row(11000, 11000, 'post_move_in'));
    expect(buildFakePriceSet(rows).size).toBe(0);
  });

  it('2단계까지는 살린다 — 3단계부터가 기준이다', () => {
    const rows = [
      row(10500, 27800, 'post_move_in'),
      row(10500, 27800, 'post_move_in'),
      row(10500, 27800, 'move_in_ready'),
    ];
    expect(buildFakePriceSet(rows).size).toBe(0);
  });

  it('3곳 미만이면 살린다', () => {
    const rows = [row(50000, 60000, 'a'), row(50000, 60000, 'b')];
    expect(buildFakePriceSet(rows).size).toBe(0);
  });
});

describe('priceOf — 렌더해도 되는 가격만 낸다', () => {
  const fake = new Set(['20800|55500']);

  it('채움값이면 비운다', () => {
    expect(priceOf(row(20800, 55500, 'post_move_in'), fake)).toBeNull();
  });

  it('정비사업 단계는 «값이 있어도» 비운다 — 확정가가 아니다', () => {
    for (const st of ['site_planning', 'union_established', 'constructor_selected',
                      'plan_approved', 'mgmt_approved', 'construction']) {
      expect(priceOf(row(30000, 40000, st), fake)).toBeNull();
    }
  });

  it('정상 값은 그대로 낸다', () => {
    expect(priceOf(row(48620, 146160, 'move_in_ready'), fake)).toEqual({ min: 48620, max: 146160 });
  });

  it('빈 값·0 은 비운다', () => {
    expect(priceOf(row(null, null, 'post_move_in'), fake)).toBeNull();
    expect(priceOf(row(0, 0, 'post_move_in'), fake)).toBeNull();
  });
});

describe('isRealSite — 공고문을 거른다 (길이 규칙은 쓰지 않는다)', () => {
  it('LH 공고문을 거른다', () => {
    expect(isRealSite('2020.2.7. LH 국민임대 예비입주자 모집공고')).toBe(false);
  });

  it('임대·행복주택·사전청약 계열을 거른다', () => {
    for (const n of ['○○ 행복주택', '△△ 국민임대', '사전청약 공공분양', '희망타운 A1', '10년공공임대리츠']) {
      expect(isRealSite(n)).toBe(false);
    }
  });

  it('⚠️ 5자짜리 실존 단지를 살린다 — length>=6 규칙을 쓰지 않는 이유', () => {
    expect(isRealSite('레이카운티')).toBe(true);
  });

  it('일반 단지명을 살린다', () => {
    for (const n of ['한화포레나 부산당리', '해링턴 마레', '엄궁역 트라비스 하늘채', '부산 대연8구역 재개발']) {
      expect(isRealSite(n)).toBe(true);
    }
  });

  it('빈 값에 던지지 않는다', () => {
    for (const n of [null, undefined, '', ' ']) expect(isRealSite(n)).toBe(false);
  });
});
