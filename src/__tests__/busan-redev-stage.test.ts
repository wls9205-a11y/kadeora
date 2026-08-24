// 마스터 §4 — 단계 값 회귀 테스트.
//
// 지키려는 것 하나: **허용 목록 밖 값이 DB 로 나가지 않는다.**
// 이 규칙이 깨져서 344건이 통째로 저장 실패했다 —
// `추진위원회 구성` 을 `추진위원회` 로 "정규화" 했는데 CHECK 에는 후자가 없었다.
// 한 행이 CHECK 를 어기면 배치 전체가 죽는다.

import { describe, expect, it } from 'vitest';
import { ALLOWED_STAGES, normalizeStage, projectTypeOf } from '@/lib/redev/busan-stage';

/**
 * `redevelopment_projects_stage_check` 실측 (2026-08-24).
 * ⚠️ DB CHECK 를 늘리면 이 배열과 lib 의 ALLOWED_STAGES 를 **함께** 늘린다.
 *    이 테스트는 둘 중 하나만 고치는 걸 막는 자물쇠다.
 */
const DB_CHECK_STAGES = [
  '정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공', '기타', '조사 중',
  '예정구역지정', '정비계획 수립 및 정비구역 지정', '추진위원회 구성', '조합설립인가',
  '건축심의 및 통합심의', '사업시행계획인가', '관리처분계획', '해제', '조합해산',
];

describe('허용 목록이 DB CHECK 와 같다', () => {
  it('빠짐도 남음도 없다', () => {
    expect([...ALLOWED_STAGES].sort()).toEqual([...DB_CHECK_STAGES].sort());
  });
});

describe('normalizeStage — 허용 목록 밖 값을 내보내지 않는다', () => {
  it('API 원문을 그대로 통과시킨다 (정규화하지 않는다)', () => {
    // 실측에서 나온 두 값. 이전 판은 이걸 '추진위원회'·'조합설립' 로 바꿔 CHECK 를 어겼다.
    expect(normalizeStage('추진위원회 구성').value).toBe('추진위원회 구성');
    expect(normalizeStage('조합설립인가').value).toBe('조합설립인가');
  });

  it('허용 목록 17종이 전부 그대로 통과한다', () => {
    for (const s of DB_CHECK_STAGES) {
      expect(normalizeStage(s), s).toEqual({ value: s, unknown: null });
    }
  });

  it('표기만 다른 옛 값은 허용 목록의 값으로 옮긴다', () => {
    expect(normalizeStage('추진위원회승인').value).toBe('추진위원회 구성');
    expect(normalizeStage('관리처분인가').value).toBe('관리처분계획');
    expect(normalizeStage('이전고시').value).toBe('준공');
  });

  it('모르는 값은 기타로 떨어뜨리고 원문을 남긴다 — 수집 전체를 막지 않는다', () => {
    expect(normalizeStage('사업시행계획인가 신청')).toEqual({
      value: '기타',
      unknown: '사업시행계획인가 신청',
    });
  });

  it('빈 값은 null — 기타로 만들지 않는다', () => {
    expect(normalizeStage(null)).toEqual({ value: null, unknown: null });
    expect(normalizeStage('   ')).toEqual({ value: null, unknown: null });
  });

  it('어떤 입력이 와도 결과는 허용 목록 안이거나 null 이다', () => {
    const inputs = ['', '   ', '알 수 없는 단계', '추진위원회', '조합설립 인가', '착공?', '한글아닌ASCII', '준공'];
    for (const raw of inputs) {
      const { value } = normalizeStage(raw);
      if (value !== null) expect(DB_CHECK_STAGES, raw).toContain(value);
    }
  });

  it("이전 판이 만들던 '추진위원회' 는 CHECK 에 없다 — 이게 344건을 막았다", () => {
    expect(DB_CHECK_STAGES).not.toContain('추진위원회');
  });
});

describe('projectTypeOf — CHECK 가 둘만 허용한다', () => {
  it('재건축이 이름에 있으면 재건축', () => {
    expect(projectTypeOf('명륜 재건축')).toBe('재건축');
  });
  it('그 외는 전부 재개발', () => {
    for (const n of ['명서1 재개발', '금사1', '괘법1 정비사업', '가로주택정비사업']) {
      expect(['재개발', '재건축']).toContain(projectTypeOf(n));
    }
  });
});
