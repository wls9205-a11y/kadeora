/**
 * 화면에 낼 현장을 고르는 «공용 조건».
 *
 * ── 왜 헬퍼인가 ─────────────────────────────────────────────────────────────
 * 홈 「지금 계약 가능」에 「부산 기장군 미분양 385세대」가 현장처럼 떠 있었다.
 * 그건 구군 «집계 한 줄» 이고, content_score 가 100 이라 정렬에서 1위였다.
 * 조건을 개별 쿼리에 흩뿌리면 새 화면이 생길 때마다 또 빠뜨린다 —
 * `apt_sites` 를 직접 읽는 곳이 이 저장소에 164곳이다.
 *
 * ⛔ 개별 쿼리에 `.eq('is_aggregate', false)` 를 손으로 적지 «말 것». 이 함수를 쓴다.
 * ⚠️ 어드민(`/api/admin/*`)은 «쓰지 않는다». 집계 행도 관리 대상이라 보여야 한다.
 */

/** 집계 행(구군 미분양 롤업 등)의 판정 기준이 되는 컬럼. 이름 패턴에 기대지 않는다. */
export const AGGREGATE_COLUMN = 'is_aggregate' as const;

/**
 * PostgREST 쿼리 빌더에 「사람에게 보여도 되는 현장」 조건을 건다.
 *
 *   const { data } = await activeSiteFilter(sb.from('apt_sites').select(COLS)).limit(20);
 *
 * @param includeInactive 아카이브 화면처럼 비활성도 봐야 할 때만 true.
 */
export function activeSiteFilter<T extends { eq: (c: string, v: unknown) => T }>(
  q: T,
  includeInactive = false,
): T {
  const withAgg = q.eq(AGGREGATE_COLUMN, false);
  return includeInactive ? withAgg : withAgg.eq('is_active', true);
}

/**
 * 이미 받아 온 행 배열에서 거른다. 조인·RPC 결과처럼 빌더를 못 쓰는 자리용.
 *
 * ⚠️ 되도록 «쿼리에서» 거를 것. 여기까지 온 행은 이미 네트워크를 탄 것이고,
 *    limit 을 먼저 먹은 뒤라면 집계 행이 자리를 차지한 만큼 진짜 현장이 잘려 나간다.
 */
export function dropAggregates<T extends { is_aggregate?: boolean | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.is_aggregate !== true);
}
