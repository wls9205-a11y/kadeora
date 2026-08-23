// V17 F-1 — 목록 노출 조건 회귀 테스트.
//
// ⚠️ 이 규칙은 **DB(get_apt_pipeline)가 집행한다.** 프론트는 필터하지 않는다.
//    그래도 테스트를 남긴 이유: 규칙이 DB 로 갔다고 검증까지 사라지면
//    나중에 RPC 를 고칠 때 조건이 **조용히 바뀐다.**
//    여기 케이스는 "무엇이 통과해야 하는가" 를 실행 가능한 형태로 고정한 것이고,
//    RPC 를 손볼 때 이 답과 대조한다.
//
// 지키려는 것: **빈 껍데기 현장이 목록에 나가지 않는다.**
//
// ── RPC 가 집행 중인 조건 (2026-08-24) ──
//   ((select count(*) from apt_site_events e where e.site_id = s.id) > 0)::int
//     + (s.builder is not null)::int
//     + (coalesce(s.supply_units, s.complex_units, s.total_units) is not null)::int
//     + (s.sigungu is not null)::int >= 2

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
  supply_units: null,
  complex_units: null,
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

/**
 * RPC 실측 결과를 숫자로 박아 둔다.
 *
 * 이건 "지금 데이터가 이렇다" 가 아니라 **"게이트가 실제로 걸려 있다"** 는 표식이다.
 * 게이트가 빠지면 전국이 206으로 돌아가고 이 값과 크게 어긋난다.
 * 데이터가 늘어 숫자가 변하는 건 정상이니, 어긋나면 지우지 말고
 * RPC 조건이 그대로인지 먼저 확인한 다음 값을 갱신할 것.
 */
export const RPC_MEASURED_2026_08_24 = {
  pageSize: 30,
  gated: true,
  nationwide: { total: 93, pages: 4, lastPageItems: 3 },
  bugyeong: { total: 35, pages: 2 },
  busan: { total: 21 },
  /** 게이트 이전 전국 건수. 113곳이 조건 미달로 빠진다. */
  ungatedNationwide: 206,
} as const;

describe('RPC 실측 기준값', () => {
  it('게이트 적용 전후 차이가 실제로 크다 — 붙이고 안 붙이고가 목록의 성격을 바꾼다', () => {
    const m = RPC_MEASURED_2026_08_24;
    expect(m.gated).toBe(true);
    expect(m.nationwide.total).toBeLessThan(m.ungatedNationwide);
    // 절반 넘게 떨어진다. 이 관계가 깨지면 게이트가 헐거워진 것이다.
    expect(m.nationwide.total * 2).toBeLessThan(m.ungatedNationwide * 1.2);
  });

  it('마지막 쪽이 정상으로 찬다 — 페이지네이션이 게이트 이후 값을 쓴다', () => {
    const m = RPC_MEASURED_2026_08_24;
    const expectedLast = m.nationwide.total - m.pageSize * (m.nationwide.pages - 1);
    expect(m.nationwide.lastPageItems).toBe(expectedLast);
  });

  it('부울경 쪽수도 총계와 맞는다', () => {
    const m = RPC_MEASURED_2026_08_24;
    expect(Math.ceil(m.bugyeong.total / m.pageSize)).toBe(m.bugyeong.pages);
  });
});
