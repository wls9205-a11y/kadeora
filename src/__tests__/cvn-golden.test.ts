/**
 * CV-N L1 — 프리디플로이 골든셋 (2026-09-08).
 *
 * ⚠️ 여기서 AI 를 부르지 않는다. 로컬·CI 에는 ANTHROPIC 키가 없고(CV-A 실증),
 *    라이브 페이지는 코드와 무관하게 바뀐다. 그 둘에 기대는 검사는 «코드가 멀쩡한데
 *    빨간» red 를 만든다. 이 파일은 결정 로직만 본다 — 그래서 push 조건이 될 수 있다.
 *
 * 실추출 정확도는 L2(배포 후 셀프테스트)의 몫이고, 그 red 는 배포 실패가 아니라
 * «섀도 강등» 이다.
 */
import { describe, expect, it } from 'vitest';
import {
  checkAliasUniqueness,
  composeDisplayName,
  decideTier,
  demoteDisplayName,
  matchSite,
  zoneKey,
  type NameCandidateInput,
  type SiteLite,
} from '@/lib/cvn/decide';
import { applyCandidate } from '@/lib/cvn/apply';
import { CONFLICT_CASE, CONFLICT_SITES, GOLDEN_CASES, GOLDEN_SITES } from '@/lib/cvn/golden';

const toInput = (c: (typeof GOLDEN_CASES)[number]): NameCandidateInput => ({
  proposedName: c.proposedName,
  eventType: c.eventType,
  source: c.source,
  sourceUrl: c.sourceUrl,
  projectName: c.projectName,
  sigungu: c.sigungu,
  builderRaw: c.builderRaw,
  crossRefs: c.crossRefs,
});

describe('CV-N 골든셋 — 매칭 흡착', () => {
  it.each(GOLDEN_CASES)('$key → 기대 현장에 붙는다', (c) => {
    const m = matchSite(toInput(c), GOLDEN_SITES);
    expect(m.ambiguous).toBe(false);
    expect(m.siteId).toBe(c.expectSiteId);
  });

  it('신규 레코드를 만들지 않는다 — 전 케이스가 기존 현장에 흡착한다', () => {
    const known = new Set(GOLDEN_SITES.map((s) => s.id));
    for (const c of GOLDEN_CASES) {
      const m = matchSite(toInput(c), GOLDEN_SITES);
      expect(m.siteId).not.toBeNull();
      expect(known.has(m.siteId as string)).toBe(true);
    }
  });

  it('형제 구역을 헷갈리지 않는다 — 촉진3 이 촉진1·2-1·4 로 새지 않는다', () => {
    const m = matchSite(toInput(GOLDEN_CASES[0]), GOLDEN_SITES);
    expect(m.siteId).toBe('69c148ec-7a30-46b4-a7d6-3104c1e8053d');
    expect(m.how).toBe('exact_project');
  });

  it('시·도가 다르면 붙지 않는다 (DART 매칭 규칙 승계)', () => {
    const m = matchSite(
      { ...toInput(GOLDEN_CASES[3]), sigungu: '동대문구' },
      GOLDEN_SITES,
    );
    expect(m.siteId).toBeNull();
  });

  it('zoneKey 가 시·도 접두를 무시한다 — 「부산 우동1 재건축」 = 「우동1 재건축」', () => {
    expect(zoneKey('부산 우동1 재건축')).toBe(zoneKey('우동1 재건축'));
  });
});

describe('CV-N 골든셋 — 티어 판정', () => {
  it.each(GOLDEN_CASES)('$key → 기대 티어·적용 여부', (c) => {
    const input = toInput(c);
    const d = decideTier(input, matchSite(input, GOLDEN_SITES));
    expect(d.tier).toBe(c.expectTier);
    expect(d.apply).toBe(c.expectApply);
  });

  it('T-C 는 교차 출처가 몇이든 적용하지 않는다 — 제안명 ≠ 확정명', () => {
    const bid = GOLDEN_CASES.find((c) => c.eventType === 'bid')!;
    for (const crossRefs of [0, 1, 2, 9]) {
      const input = { ...toInput(bid), crossRefs };
      const d = decideTier(input, matchSite(input, GOLDEN_SITES));
      expect(d.tier).toBe('T-C');
      expect(d.apply).toBe(false);
    }
  });

  it('win 이 도착하면 같은 현장이 T-B 로 승격한다', () => {
    const bid = GOLDEN_CASES.find((c) => c.eventType === 'bid')!;
    const input = { ...toInput(bid), eventType: 'win' as const, crossRefs: 1 };
    const d = decideTier(input, matchSite(input, GOLDEN_SITES));
    expect(d.tier).toBe('T-B');
    expect(d.apply).toBe(true);
  });

  it('교차 출처가 없으면 win 이어도 기다린다', () => {
    const c = GOLDEN_CASES.find((x) => x.key === 'bifc-signature')!;
    const input = { ...toInput(c), crossRefs: 0 };
    const d = decideTier(input, matchSite(input, GOLDEN_SITES));
    expect(d.apply).toBe(false);
    expect(d.resolution).toBe('pending');
  });

  it('미매칭을 폐기하지 않는다 — 후보로 남는다', () => {
    const input: NameCandidateInput = {
      proposedName: '어딘가 새 이름',
      projectName: '존재하지않는9구역 재개발',
      sigungu: '남구',
      eventType: 'win',
      source: 'news:naver',
      crossRefs: 2,
    };
    const d = decideTier(input, matchSite(input, GOLDEN_SITES));
    expect(d.resolution).toBe('pending');
    expect(d.apply).toBe(false);
  });
});

describe('CV-N 골든셋 — 유일성 라우팅', () => {
  it('같은 별칭이 다른 활성 현장에 있으면 주입이 아니라 병합 큐로 간다', () => {
    // 「해운대 아크로」가 우동1·반여3 «둘 다» 에 앉아 있던 2026-09-08 이전 상태를 재현한다.
    const before: SiteLite[] = GOLDEN_SITES.map((s) =>
      s.id === '5b03bbd1-774e-427d-a843-a7d808c99554' ||
      s.id === 'f99ee93d-2b5a-46fd-adba-0c1736cf5449'
        ? { ...s, name_variants: [...(s.name_variants ?? []), '해운대 아크로'] }
        : s,
    );
    const r = checkAliasUniqueness('해운대 아크로', '5b03bbd1-774e-427d-a843-a7d808c99554', before);
    expect(r.ok).toBe(false);
    expect(r.conflicts).toContain('f99ee93d-2b5a-46fd-adba-0c1736cf5449');
  });

  it('현재 상태에서는 「해운대 아크로」 충돌이 해소돼 있다', () => {
    const r = checkAliasUniqueness('해운대 아크로', '5b03bbd1-774e-427d-a843-a7d808c99554', GOLDEN_SITES);
    expect(r.ok).toBe(true);
  });

  it('다른 현장의 «대표명» 과 같아도 충돌이다', () => {
    const r = checkAliasUniqueness('문현3 재개발', 'b286cae6-82cb-4074-9a27-f6853b86f5c7', GOLDEN_SITES);
    expect(r.ok).toBe(false);
  });

  it('자기 자신은 충돌이 아니다', () => {
    const r = checkAliasUniqueness('촉진3구역', '69c148ec-7a30-46b4-a7d6-3104c1e8053d', GOLDEN_SITES);
    expect(r.ok).toBe(true);
  });
});

describe('CV-N 골든셋 — display 규격', () => {
  it.each(GOLDEN_CASES.filter((c) => c.expectDisplay))('$key → 「{예정명} — {구역명}」', (c) => {
    const site = GOLDEN_SITES.find((s) => s.id === c.expectSiteId)!;
    const got =
      c.eventType === 'rename' || c.eventType === 'cancel'
        ? demoteDisplayName(site.name)
        : composeDisplayName(c.proposedName, site.name);
    expect(got).toBe(c.expectDisplay);
  });

  it('예정명이 구역명을 이미 품고 있으면 겹쳐 쓰지 않는다', () => {
    expect(composeDisplayName('가야1 재개발 더 다이너스티', '가야1 재개발')).toBe(
      '가야1 재개발 더 다이너스티',
    );
  });

  it('강등은 예정명을 지우지 않는다 — 표시만 구역명으로 돌아간다', () => {
    expect(demoteDisplayName('우동1 재건축')).toBe('우동1 재건축');
  });
});


/**
 * 충돌 경로 — 2026-09-08 채록. AI 도 DB 도 없다(가짜 admin 이 호출만 기록한다).
 *
 * ⚠️ 이 경로는 그날까지 «실전 검증이 없었다». 워처 첫 회전의 pending 은 충돌이 아니라
 *    「교차 출처 부족」이었고, 유일성 검사는 apply=false 라 돌지도 않았다.
 *    그 공백을 실물(광안A ↔ 망미 이중)로 메운다.
 */
function fakeAdmin() {
  const calls: Array<{ table: string; op: string; row: any }> = [];
  const from = (table: string) => ({
    upsert: (row: any) => {
      calls.push({ table, op: 'upsert', row });
      return { select: () => ({ maybeSingle: async () => ({ data: { id: 1 }, error: null }) }) };
    },
    insert: async (row: any) => {
      calls.push({ table, op: 'insert', row });
      return { data: null, error: null };
    },
    update: (row: any) => {
      calls.push({ table, op: 'update', row });
      return { eq: async () => ({ data: null, error: null }) };
    },
  });
  return { admin: { from } as any, calls };
}

const conflictInput = {
  proposedName: CONFLICT_CASE.proposedName,
  eventType: CONFLICT_CASE.eventType,
  source: CONFLICT_CASE.source,
  sourceUrl: CONFLICT_CASE.sourceUrl,
  projectName: CONFLICT_CASE.projectName,
  sigungu: CONFLICT_CASE.sigungu,
  builderRaw: CONFLICT_CASE.builderRaw,
  crossRefs: CONFLICT_CASE.crossRefs,
};

describe('CV-N 충돌 경로 — 주입이 아니라 병합 큐', () => {
  it('티어 단계에서는 «적용 가능» 하다 — 막는 것은 유일성이지 티어가 아니다', () => {
    const m = matchSite(conflictInput, CONFLICT_SITES);
    expect(m.siteId).toBe(CONFLICT_CASE.expectSiteId);
    const d = decideTier(conflictInput, m);
    expect(d.tier).toBe('T-B');
    expect(d.apply).toBe(true);
  });

  it('적용기를 거치면 merge_queue 로 떨어지고 «아무것도 쓰지 않는다»', async () => {
    const { admin, calls } = fakeAdmin();
    const out = await applyCandidate(conflictInput, CONFLICT_SITES, {
      admin, runId: 'test-conflict', autoApply: true,
    });
    expect(out.resolution).toBe('merge_queue');
    expect(out.wrote).toBe(false);
    expect(out.aliasAdded).toBeUndefined();

    // ⛔ apt_sites 를 한 번도 건드리지 않아야 한다 — 충돌 상태에서 별칭을 주입하면
    //    그것이 곧 라로체 3각의 출생이다.
    expect(calls.filter((c) => c.table === 'apt_sites')).toHaveLength(0);

    // 큐에는 «남는다». 폐기가 아니다.
    const queued = calls.find((c) => c.table === 'site_name_candidates');
    expect(queued?.row?.resolution).toBe('merge_queue');
  });

  it('autoApply 가 꺼져 있어도 충돌 판정이 섀도에 가려지지 않는다', async () => {
    const { admin } = fakeAdmin();
    const out = await applyCandidate(conflictInput, CONFLICT_SITES, {
      admin, runId: 'test-conflict-shadow', autoApply: false,
    });
    // 충돌은 섀도보다 «먼저» 판정된다 — 원장에 이유가 정확히 남아야 한다.
    expect(out.resolution).toBe('merge_queue');
    expect(out.wrote).toBe(false);
  });

  it('⚠️ builder 표기 차이(대림산업 ↔ DL이앤씨)로 충돌 판정이 갈리지 않는다', () => {
    // 같은 회사의 옛 이름이다. 충돌은 «별칭» 으로만 판정한다.
    const r = checkAliasUniqueness('아크로 광안', '5435f730-83c4-44c7-b4ea-c6d780fedf0b', CONFLICT_SITES);
    expect(r.ok).toBe(false);
    expect(r.conflicts).toContain('62a9f1cd-86db-4ec0-b420-f1190a72cb23');
  });

  it('충돌이 해소된 뒤에는 같은 후보가 정상 적용된다 — 큐가 영구 정체되지 않는다', async () => {
    const merged = CONFLICT_SITES.map((s) =>
      s.id === '62a9f1cd-86db-4ec0-b420-f1190a72cb23'
        ? { ...s, name_variants: (s.name_variants ?? []).filter((v) => v !== '아크로 광안') }
        : s,
    );
    const { admin } = fakeAdmin();
    const out = await applyCandidate(conflictInput, merged, {
      admin, runId: 'test-conflict-resolved', autoApply: true,
    });
    expect(out.resolution).toBe('applied');
    expect(out.wrote).toBe(true);
    expect(out.aliasAdded).toBe('아크로 광안');
  });
});
