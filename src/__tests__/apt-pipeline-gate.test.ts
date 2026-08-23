// V17 F-1 — 목록 노출 조건 회귀 테스트.
//
// 지키려는 것: **빈 껍데기 현장이 목록에 나가지 않는다.**
// 실측 2026-08-24 파이프라인 206곳 중 93곳만 통과한다(113곳 탈락).

import { describe, expect, it } from 'vitest';
import {
  MIN_SIGNALS,
  countSignals,
  hasSigungu,
  passesComposition,
  signalsOf,
} from '@/lib/apt/pipeline-gate';
import type { AptPipelineItem } from '@/lib/apt/pipeline';

const item = (o: Partial<AptPipelineItem>): AptPipelineItem => ({
  id: 'x',
  house_nm: '테스트 현장',
  site_slug: 'test',
  region_nm: '부산',
  supply_addr: '부산',
  households: null,
  builder: null,
  thumb_url: null,
  status: 'union_established',
  previous_stage: null,
  stage_updated_at: null,
  confidence: 'confirmed',
  weight: 5,
  ...o,
});

describe('위치 신호 — 시군구까지 있어야 한다', () => {
  it('시·도만 있으면 위치를 안다고 할 수 없다', () => {
    // RPC 의 supply_addr 은 concat_ws(region, sigungu, dong) 이라 시·도만 있어도 비지 않는다.
    expect(hasSigungu('부산', '부산')).toBe(false);
    expect(hasSigungu('', '부산')).toBe(false);
    expect(hasSigungu(null, '부산')).toBe(false);
  });
  it('시군구가 붙으면 통과', () => {
    expect(hasSigungu('부산 해운대구', '부산')).toBe(true);
    expect(hasSigungu('경남 김해시', '경남')).toBe(true);
  });
});

describe('세대수 신호', () => {
  it('0 은 세대수를 아는 게 아니다', () => {
    expect(signalsOf(item({ households: 0 }), false).units).toBe(false);
  });
  it('양수면 통과', () => {
    expect(signalsOf(item({ households: 299 }), false).units).toBe(true);
  });
});

describe('시공사 신호', () => {
  it('공백 문자열은 시공사가 아니다', () => {
    expect(signalsOf(item({ builder: '   ' }), false).builder).toBe(false);
  });
});

describe('2개 이상일 때만 목록에 낸다', () => {
  it('아무것도 없으면 탈락', () => {
    expect(passesComposition(item({}), false)).toBe(false);
  });

  it('하나만 있으면 탈락 — 시공사만', () => {
    expect(passesComposition(item({ builder: '대우건설' }), false)).toBe(false);
  });

  it('하나만 있으면 탈락 — 이력만', () => {
    expect(passesComposition(item({}), true)).toBe(false);
  });

  it('시공사 + 세대수 → 통과', () => {
    expect(passesComposition(item({ builder: '대우건설', households: 299 }), false)).toBe(true);
  });

  it('이력 + 위치 → 통과', () => {
    expect(passesComposition(item({ supply_addr: '경남 김해시', region_nm: '경남' }), true)).toBe(true);
  });

  it('실측 통과 사례 — 김해 삼계동 재개발', () => {
    const real = item({
      house_nm: '김해 삼계동 재개발',
      region_nm: '경남',
      supply_addr: '경남 김해시',
      builder: '대우건설',
      households: 299,
      status: 'construction',
    });
    expect(countSignals(signalsOf(real, true))).toBe(4);
    expect(passesComposition(real, true)).toBe(true);
  });

  it('기준값이 2다', () => {
    expect(MIN_SIGNALS).toBe(2);
  });
});
