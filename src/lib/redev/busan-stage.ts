// 마스터 §4 — 부산 정비사업 API 의 단계 값 정리.
//
// ⚠️ 이 로직 때문에 **344건이 통째로 저장 실패**했다.
//    이전 판이 `추진위원회 구성` 을 `추진위원회` 로 "정규화" 했는데
//    `redevelopment_projects_stage_check` 에는 `추진위원회 구성` 만 있고 `추진위원회` 는 없다.
//    한 행이 CHECK 를 어기면 배치 전체가 실패하고, 그게 344건이었다.
//
// 그래서 규칙을 뒤집었다 — **API 원문이 이미 허용 목록에 있으므로 정규화하지 않는다.**
// 그리고 허용 목록 밖 값은 **절대 내보내지 않는다.** 새 단계명이 하나 등장했다고
// 수집 전체가 막히면 안 된다.
//
// route 파일이 아니라 lib 에 둔 이유: Next 라우트는 임의 심볼을 export 하면
// 라우트 타입 검사가 깨진다. 테스트에서 진짜 모듈을 import 하려면 여기 있어야 한다.

/**
 * `redevelopment_projects_stage_check` 허용 값 17종 (2026-08-24 실측).
 * ⚠️ DB CHECK 를 늘리면 여기도 함께 늘린다. 한쪽만 고치면 조용히 '기타' 로 떨어진다.
 */
export const ALLOWED_STAGES: readonly string[] = [
  '정비구역지정',
  '조합설립',
  '사업시행인가',
  '관리처분',
  '착공',
  '준공',
  '기타',
  '조사 중',
  '예정구역지정',
  '정비계획 수립 및 정비구역 지정',
  '추진위원회 구성',
  '조합설립인가',
  '건축심의 및 통합심의',
  '사업시행계획인가',
  '관리처분계획',
  '해제',
  '조합해산',
];

const ALLOWED = new Set(ALLOWED_STAGES);

/** 표기만 다른 옛 값 → 허용 목록의 값. 원문이 이미 허용되면 손대지 않는다. */
const STAGE_ALIASES: Record<string, string> = {
  '추진위원회승인': '추진위원회 구성',
  '추진위원회구성': '추진위원회 구성',
  '관리처분인가': '관리처분계획',
  '관리처분계획인가': '관리처분계획',
  '이전고시': '준공',
};

export interface StageResult {
  /** DB 에 넣을 값. 항상 허용 목록 안이거나 null 이다. */
  value: string | null;
  /** 허용 목록에 없어 '기타' 로 떨어진 원문. 로그에 남겨 다음에 맵을 늘린다. */
  unknown: string | null;
}

export function normalizeStage(raw: string | null | undefined): StageResult {
  const s = (raw ?? '').trim();
  if (!s) return { value: null, unknown: null };
  const aliased = STAGE_ALIASES[s] ?? s;
  if (ALLOWED.has(aliased)) return { value: aliased, unknown: null };
  return { value: '기타', unknown: s };
}

/**
 * `redevelopment_projects_project_type_check` 는 **재개발·재건축 둘만** 허용한다.
 * 그 밖의 값이 나올 수 없게 여기서 닫는다.
 */
export function projectTypeOf(districtName: string): '재개발' | '재건축' {
  return districtName.includes('재건축') ? '재건축' : '재개발';
}
