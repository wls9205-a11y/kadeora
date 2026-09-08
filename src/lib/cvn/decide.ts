/**
 * CV-N — 예정명 후보의 «결정» 층 (2026-09-08).
 *
 * 여기에는 AI 도 네트워크도 DB 도 없다. 입력을 주면 같은 답이 나오는 순수 함수뿐이다.
 * 그래서 L1(프리디플로이) 골든셋이 «키 없이·배포 없이» 이 층을 통째로 검사할 수 있다.
 *
 * ── 왜 층을 갈랐나 ──────────────────────────────────────────────────────────
 * v1.1 의 「골든셋 red = 정지」는 AI 를 어디서 돌리는지가 비어 있었다. 로컬·CI 에는
 * ANTHROPIC 키가 없고(CV-A 실증), 라이브 페이지는 코드와 무관하게 바뀐다.
 * 그 둘을 그대로 두면 «코드가 멀쩡한데 배포가 막히는» red 가 난다.
 *   L1 = 이 파일 (AI 무호출·결정 로직) → push 조건
 *   L2 = 배포된 엔드포인트에서 실추출 1회 → autoapply 를 «켜는» 조건
 * 그래서 한방 배포는 어떤 경우에도 성공하고, 위험할 때 스스로 섀도로 내려간다.
 */

export type EventType = 'bid' | 'win' | 'name_confirm' | 'rename' | 'cancel';
export type Tier = 'T-A' | 'T-B' | 'T-C' | 'T-역';

/** 매칭 대상이 되는 현장의 «결정에 필요한 만큼» 만. DB row 전체를 끌고 다니지 않는다. */
export interface SiteLite {
  id: string;
  name: string;
  display_name?: string | null;
  sigungu?: string | null;
  region?: string | null;
  builder?: string | null;
  total_units?: number | null;
  name_variants?: string[] | null;
  is_active?: boolean | null;
}

/** AI 추출이 뱉은 한 장. 여기 없는 필드는 결정에 쓰지 않는다. */
export interface NameCandidateInput {
  proposedName: string;
  eventType: EventType;
  /** 'brand_registry:아크로' | 'news:naver' — 접두가 곧 «출처의 급» 이다. */
  source: string;
  sourceUrl?: string | null;
  /** 브랜드관·기사가 말한 사업명(=구역명). 매칭의 «1차 키» 다. */
  projectName?: string | null;
  region?: string | null;
  sigungu?: string | null;
  builderRaw?: string | null;
  totalUnits?: number | null;
  /** 같은 사실을 말한 «다른» 출처 수. T-B 는 교차 1건 이상을 요구한다. */
  crossRefs?: number;
}

/* ────────────────────────────────────────────────────────── 이름 정규화 */

/** 비교용 정규화. 공백·괄호·가운뎃점을 지운다 — 표기 변형은 같은 이름이다. */
export function norm(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/[\s()（）·・,，]/g, '')
    .replace(/재정비촉진/g, '촉진')
    .toLowerCase();
}

/**
 * 구역명 «핵심» 추출 — 「시민공원주변재정비촉진3구역 재개발」 → 「촉진3」.
 *
 * ⚠️ 이것은 매칭 «보조» 다. 1차는 언제나 사업명 정확일치이고, 여기까지 오는 것은 그 다음이다.
 * ⚠️ 시·도 접두는 떼고 본다 — 「부산 우동1 재건축」과 「우동1 재건축」은 같은 구역이다.
 *    (그 둘이 실제로 이중 레코드로 앉아 있었다.)
 */
export function zoneKey(s: string | null | undefined): string | null {
  const n = norm(s);
  const m = n.match(/([가-힣]{2,10}?)(\d+(?:-\d+)?)(구역|지구)?(재개발|재건축|촉진)?/);
  if (!m) return null;
  const head = m[1].replace(/^(부산|울산|경남|서울|경기)/, '');
  if (!head || head.length < 2) return null;
  return head + m[2];
}

/* ────────────────────────────────────────────────────────── 매칭 */

export interface MatchResult {
  siteId: string | null;
  /** 'exact_project' | 'zone_key' | 'alias' | null */
  how: string | null;
  /** 후보가 둘 이상이면 «고르지 않는다» — 검수 큐로 보낸다. */
  ambiguous: boolean;
}

/**
 * 후보를 현장에 흡착시킨다.
 *
 * ⛔ 새 레코드를 만들지 않는다. 브랜드명으로 들어온 인입이 기존 구역 레코드를 못 찾고
 *    새로 앉으면 그것이 곧 «이중 레코드» 다 — 라로체 3각과 우동1 이중이 그렇게 태어났다.
 * ⛔ 애매하면 «고르지 않는다». DART 매칭에서 정한 규칙을 그대로 승계한다:
 *    구역명 정확일치 + 시·도 일치만 자동, 나머지는 검수 큐.
 */
export function matchSite(input: NameCandidateInput, sites: SiteLite[]): MatchResult {
  const active = sites.filter((s) => s.is_active !== false);
  const regionOk = (s: SiteLite) => {
    const want = norm(input.sigungu);
    if (!want) return true; // 지역을 모르면 지역으로 «떨어뜨리지» 않는다
    const got = norm(s.sigungu);
    return !got || got === want || got.includes(want) || want.includes(got);
  };

  // ① 사업명 정확일치 (+ 지역 일치)
  const pn = norm(input.projectName);
  if (pn) {
    const hit = active.filter((s) => norm(s.name) === pn && regionOk(s));
    if (hit.length === 1) return { siteId: hit[0].id, how: 'exact_project', ambiguous: false };
    if (hit.length > 1) return { siteId: null, how: 'exact_project', ambiguous: true };
  }

  // ② 구역 키 (촉진3 · 우동1 · 문현1 …) + 지역 일치
  const zk = zoneKey(input.projectName);
  if (zk) {
    const hit = active.filter((s) => zoneKey(s.name) === zk && regionOk(s));
    if (hit.length === 1) return { siteId: hit[0].id, how: 'zone_key', ambiguous: false };
    if (hit.length > 1) return { siteId: null, how: 'zone_key', ambiguous: true };
  }

  // ③ 예정명이 이미 «어딘가의 별칭» 이면 그 현장이다 (매칭기 별칭축 · N-4-4).
  //    청약홈·presale 인입이 브랜드명으로 와도 기존 구역 레코드에 흡착시키는 축이 이것이다 —
  //    대연3 ↔ 디아이엘 재발 방지.
  const nm = norm(input.proposedName);
  if (nm) {
    const hit = active.filter(
      (s) => (s.name_variants ?? []).some((v) => norm(v) === nm) || norm(s.display_name) === nm,
    );
    if (hit.length === 1) return { siteId: hit[0].id, how: 'alias', ambiguous: false };
    if (hit.length > 1) return { siteId: null, how: 'alias', ambiguous: true };
  }

  return { siteId: null, how: null, ambiguous: false };
}

/* ────────────────────────────────────────────────────────── 유일성 */

export interface UniquenessResult {
  ok: boolean;
  /** 충돌한 다른 현장들. 비어 있지 않으면 주입이 아니라 «병합 큐» 다. */
  conflicts: string[];
}

/**
 * 별칭 유일성 — 주입 «전» 에 활성 전 레코드와 충돌을 본다.
 *
 * 라로체 3각의 출생 지점이 여기다. 「해운대 아크로」가 우동1·반여3 둘 다에 앉아 있었고
 * (둘 다 DL·해운대) 어느 쪽도 가리키지 못했다. 충돌은 «주입» 이 아니라 «병합 큐» 로 간다.
 */
export function checkAliasUniqueness(
  alias: string,
  targetSiteId: string,
  sites: SiteLite[],
): UniquenessResult {
  const a = norm(alias);
  const conflicts = sites
    .filter((s) => s.is_active !== false && s.id !== targetSiteId)
    .filter((s) => (s.name_variants ?? []).some((v) => norm(v) === a) || norm(s.name) === a)
    .map((s) => s.id);
  return { ok: conflicts.length === 0, conflicts };
}

/* ────────────────────────────────────────────────────────── 티어 */

export type Resolution = 'pending' | 'applied' | 'held' | 'rejected' | 'merge_queue' | 'shadow';

export interface TierDecision {
  tier: Tier | null;
  /** 이 후보로 «지금» 별칭·display 를 쓰는가. T-C 는 언제나 false 다. */
  apply: boolean;
  resolution: Resolution;
  reason: string;
}

/**
 * 티어 판정 — N-3 의 심장. 사람의 손이 닿는 곳이 없다.
 *
 * ⚠️ 제안명 ≠ 확정명. 수주전 bid 의 제안명을 앉히면 진 컨소시엄의 이름으로 그 현장을
 *    영영 잘못 부른다. T-C 가 그 문이고, win 이 도착하면 그때 T-B 로 승격한다.
 * ⚠️ 해지·개명은 «삭제» 가 아니다. 별칭은 남기고 display 만 내린다 — 사람들은 한동안
 *    옛 이름으로 검색한다. 지우면 그 검색이 어디에도 닿지 않는다.
 */
export function decideTier(input: NameCandidateInput, matched: MatchResult): TierDecision {
  if (matched.ambiguous) {
    return {
      tier: null,
      apply: false,
      resolution: 'merge_queue',
      reason: '매칭 후보 다수 — 자동 선택 금지',
    };
  }

  if (input.eventType === 'rename' || input.eventType === 'cancel') {
    return {
      tier: 'T-역',
      apply: !!matched.siteId,
      resolution: matched.siteId ? 'applied' : 'pending',
      reason: '개명·해지 — display 강등, 별칭은 유지한다(삭제 금지)',
    };
  }

  if (input.eventType === 'bid') {
    return {
      tier: 'T-C',
      apply: false,
      resolution: 'held',
      reason: '수주전 제안명 — win 도착 시 T-B 로 승격',
    };
  }

  if (!matched.siteId) {
    return { tier: null, apply: false, resolution: 'pending', reason: '미매칭 — 폐기하지 않고 후보로 남긴다' };
  }

  const isRegistry = input.source.startsWith('brand_registry:');
  if (isRegistry && (matched.how === 'exact_project' || matched.how === 'zone_key')) {
    return { tier: 'T-A', apply: true, resolution: 'applied', reason: '공식 브랜드관 + 사업명 매칭' };
  }

  if (input.eventType === 'win' || input.eventType === 'name_confirm') {
    if ((input.crossRefs ?? 0) >= 1) {
      return { tier: 'T-B', apply: true, resolution: 'applied', reason: 'win·확정 보도 + 교차 1건' };
    }
    return { tier: null, apply: false, resolution: 'pending', reason: '교차 출처 부족 — 1건 더 기다린다' };
  }

  return { tier: null, apply: false, resolution: 'pending', reason: '분류 불충분' };
}

/* ────────────────────────────────────────────────────────── display 규격 */

/**
 * 표시명 규격 — 「{예정명} — {구역명}」.
 *
 * ⚠️ name 도 slug 도 바꾸지 않는다. name 은 공공API 매칭 키이고 slug 는 색인·301 의 기준이다.
 *    바뀌는 것은 display_name «컬럼 값» 뿐이고, 배선은 이미 깔려 있다(seo-name.displayNameOf).
 * ⚠️ 예정명이 구역명을 이미 품고 있으면 겹쳐 쓰지 않는다.
 */
export function composeDisplayName(proposedName: string, siteName: string): string {
  const p = (proposedName ?? '').trim();
  const s = (siteName ?? '').trim();
  if (!p) return s;
  if (!s || norm(p).includes(norm(s))) return p;
  return `${p} — ${s}`;
}

/** T-역 강등 — 예정명은 별칭으로 남기고 표시만 구역명으로 되돌린다. */
export function demoteDisplayName(siteName: string): string {
  return (siteName ?? '').trim();
}
