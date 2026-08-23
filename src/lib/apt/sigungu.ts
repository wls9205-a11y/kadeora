// v4-C8 — 공급 주소에서 시군구 추출.
//
// hub RPC 는 시군구 집계를 주지 않는다. 하지만 cards[].supply_addr 이
// "부산광역시 남구 문현동 334번지 일원" 형태의 완전 주소라 두 번째 토큰이 시군구다.
// 이미 받은 payload 에서 뽑으므로 조회가 늘지 않고, **실제 물량이 있는 시군구만**
// 자연히 나온다 (부산 16개 구를 전부 내면 C3 에서 고친 문제가 그대로 반복된다).
//
// 실측(2026-08-23) 확인한 형태:
//   경기도 부천시 원미구 …      → 부천시   (시 아래 구는 합치지 않는다 — 칩이 두 배가 된다)
//   경기도 용인시 처인구 …      → 용인시
//   부산광역시 기장군 장안읍 …  → 기장군
//   세종특별자치시 …            → 없음 (시군구 계층이 없다)

/** 두 번째 토큰이 시/군/구로 끝날 때만 시군구로 인정한다. */
export function sigunguOf(addr?: string | null): string | null {
  if (!addr) return null;
  const tok = addr.trim().split(/\s+/)[1];
  if (!tok) return null;
  const clean = tok.replace(/[,·]+$/, '');
  return /[시군구]$/.test(clean) ? clean : null;
}

/** 카드 목록 → [시군구, 건수] 가나다 고정 정렬. C3 과 같은 원칙 — 순서가 매일 바뀌면 안 된다. */
export function sigunguCounts<T extends { supply_addr?: string | null }>(
  items: T[],
): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const s = sigunguOf(it.supply_addr);
    if (!s) continue;
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
