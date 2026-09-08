/**
 * NV-5 ④ — 이벤트 예정명을 순위 «측정 표적» 으로 자동 등재 (2026-09-08).
 *
 * 이름이 태어난 날 그 검색어를 재기 시작해야 「발행 → 첫 진입」 리드타임을 잴 수 있다.
 * 나중에 손으로 넣으면 그 사이 구간이 통째로 비고, 선점의 시간 가치는 «측정되지 않은 채»
 * 지나간다.
 *
 * ⛔ 무한히 늘리지 않는다. 일 측정 용량이 80이라 표적이 그보다 많으면 매일 재는 대상이
 *    잘려 나가고, 그러면 «새 예정명이 측정되지 않는» 역전이 생긴다.
 *    총량·수명은 DB 함수 fn_nv5_rank_target_lifecycle() 이 밤마다 정리한다.
 */

/** 의도 접미. ⚠️ 사람이 실제로 치는 말만 — 「부울경」 같은 내부 용어는 넣지 않는다. */
const INTENTS = ['', ' 분양가', ' 청약', ' 입주'] as const;

/** P1(우선 측정) 풀 상한. 일 측정 80 의 안전율. */
export const P1_CAP = 70;

export interface RankTargetSeed {
  keyword: string;
  priority: number;
  note: string;
}

/**
 * 예정명 하나에서 표적 키워드를 만든다.
 *
 * ⚠️ 이벤트당 4키워드가 상한이다(방안서 §1). 의도를 더 늘리면 P1 풀이 며칠 만에 찬다.
 * ⚠️ 너무 짧은 이름은 표적으로 쓰지 않는다 — 「자이」 같은 단독 브랜드는 어느 현장도
 *    가리키지 못하고, 그건 sa.py 가 광고에서 이미 막고 있는 것과 같은 병이다.
 */
export function buildRankTargets(proposedName: string, max = 4): RankTargetSeed[] {
  const name = (proposedName ?? '').trim();
  if (name.length < 4) return [];
  return INTENTS.slice(0, Math.max(1, Math.min(max, INTENTS.length))).map((suffix) => ({
    keyword: `${name}${suffix}`,
    priority: 1,
    note: 'NV5-auto',
  }));
}

/**
 * 표적을 등재한다. 이미 있으면 «건드리지 않는다» — 사람이 손으로 조정한 priority 를
 * 자동 등재가 되돌리면 안 된다.
 *
 * ⛔ 상한을 넘겨서까지 밀어 넣지 않는다. 자리가 없으면 그날은 넣지 않고 수를 보고한다 —
 *    밤 정리(fn_nv5_rank_target_lifecycle)가 오래된 안정 표적을 강등해 자리를 만든다.
 */
export async function registerRankTargets(
  admin: any,
  proposedName: string,
  max = 4,
): Promise<{ requested: number; inserted: number; skipped: number; reason?: string }> {
  const seeds = buildRankTargets(proposedName, max);
  if (!seeds.length) return { requested: 0, inserted: 0, skipped: 0, reason: '이름이 짧다' };

  try {
    const { count: p1 } = await admin
      .from('keyword_rank_targets')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 1)
      .eq('tracked', true);
    const room = Math.max(0, P1_CAP - (p1 ?? 0));
    if (room <= 0) {
      return { requested: seeds.length, inserted: 0, skipped: seeds.length, reason: `P1 상한 ${P1_CAP} 도달` };
    }

    const take = seeds.slice(0, room);
    const { data: existing } = await admin
      .from('keyword_rank_targets')
      .select('keyword')
      .in('keyword', take.map((s) => s.keyword));
    const have = new Set(((existing ?? []) as Array<{ keyword: string }>).map((r) => r.keyword));
    const fresh = take.filter((s) => !have.has(s.keyword));
    if (!fresh.length) {
      return { requested: seeds.length, inserted: 0, skipped: seeds.length, reason: '전부 이미 등재' };
    }

    const { error } = await admin.from('keyword_rank_targets').insert(
      fresh.map((s) => ({ keyword: s.keyword, priority: s.priority, note: s.note, tracked: true, active: true })),
    );
    // ⛔ 실패를 삼키지 않는다 — 조용한 0건이 오늘 한 번 사고를 냈다(LB-6 ①).
    if (error) {
      return { requested: seeds.length, inserted: 0, skipped: seeds.length, reason: `등재 실패: ${error.message}` };
    }
    return { requested: seeds.length, inserted: fresh.length, skipped: seeds.length - fresh.length };
  } catch (e) {
    return { requested: seeds.length, inserted: 0, skipped: seeds.length, reason: String(e).slice(0, 120) };
  }
}
