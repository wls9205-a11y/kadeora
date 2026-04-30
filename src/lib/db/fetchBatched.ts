// s216: PostgREST default db-max-rows=1000 우회 헬퍼.
// supabase-js .range(N, M) 쓸 때 M-N+1 ≤ 1000 이어야 실제로 그만큼 반환됨.
// 더 많이 원하면 여러 번 호출 필요 — 본 헬퍼들이 그 역할.

export const POSTGREST_BATCH = 1000;

// Builder-style: 호출자가 (offset, limit) 받아 query 빌드.
// sitemap/[id], admin/v2 같이 query 가 복잡한 곳에서 사용.
export async function fetchBatched<T = any>(
  buildQuery: (offset: number, limit: number) => any,
  targetCount: number,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (all.length < targetCount) {
    const batch = Math.min(POSTGREST_BATCH, targetCount - all.length);
    try {
      const { data, error } = await buildQuery(offset, batch);
      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < batch) break;
      offset += data.length;
    } catch {
      break;
    }
  }
  return all;
}

// Table-style: 단순 단일 테이블 fetch.
// sitemap-image 처럼 .from(table).select(cols) + 필터 만 적용하는 경우에 사용.
export async function fetchAll(
  sb: any,
  table: string,
  cols: string,
  apply: (q: any) => any,
  pageSize = POSTGREST_BATCH,
  maxPages = 50,
): Promise<any[]> {
  const all: any[] = [];
  for (let i = 0; i < maxPages; i++) {
    const q = apply((sb as any).from(table).select(cols));
    const { data } = await q.range(i * pageSize, (i + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}
