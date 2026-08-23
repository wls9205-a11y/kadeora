// V16 E-1·E-2 — DART 공급계약 공시 → 정비사업 현장 매칭.
//
// 시공사 선정의 가장 빠른 공식 신호다. 조합 총회 다음 날, 언론보다 먼저 나온다.
//
// ── 1차 필터 ──
//   corp_name 이 건설사 **AND** 본문에 `구역` 또는 `정비사업`.
//   ⚠️ 둘 다 아니면 **큐에도 넣지 않고 버린다.** 이름만 보면 조선·전자가 섞인다 —
//      실측: HJ중공업 14 · 삼성중공업 9 · 한화오션 7 · 현대오토에버 6.
//      본문 조건이 그것들을 떨어뜨리는 유일한 방어선이다.
//
// ── 자동 반영 (두 조건 모두) ──
//   ① 구역명이 apt_sites.name **또는** name_variants 와 **정확 일치**
//   ② corp_name 이 그 현장의 builder 와 일치
//   → confidence='confirmed', stage_source='dart', source_url=공시 링크
//
// ── 그 외 ──
//   검수 큐. 확신이 없으면 아무것도 쓰지 않는다.
//
// ⚠️ 부분 문자열 매칭 금지. `대우`·`삼성` 같은 브랜드명 단독 현장이 실재하고
//    (1980~90년대 아파트는 실제로 이름이 그렇다) 짧은 이름이 키워드에 걸린다.
//    잘못된 매칭은 없는 것보다 나쁘다 — 확정 등급으로 화면에 나가고 광고 랜딩까지 흘러간다.

/**
 * 건설사 판별. 1차 필터의 절반이다 — 나머지 절반(본문 조건)이 반드시 함께 걸려야 한다.
 * 이 목록만으로는 조선·중공업이 새지 않지만, 새더라도 본문 조건에서 떨어진다.
 */
const CORP_HINT = /(건설|산업개발|이앤씨|E&C|엔지니어링|종합건설|주택|디벨롭|개발㈜)/i;

/** 이름에 걸리기 쉬운 비건설 업종. 실측으로 확인된 오탐원. */
const CORP_DENY = /(중공업|오션|조선|해양|오토에버|전자|반도체|화학|바이오|제약|금융|증권|보험)/;

export function isConstructionCorp(corpName: string | null | undefined): boolean {
  const n = (corpName ?? '').trim();
  if (!n) return false;
  if (CORP_DENY.test(n)) return false;
  return CORP_HINT.test(n);
}

/** 공급계약 체결 공시인가. 정정본도 같은 신호로 본다. */
export function isSupplyContract(reportNm: string | null | undefined): boolean {
  return /단일판매.{0,2}공급계약/.test((reportNm ?? '').replace(/\s+/g, ''));
}

/** 본문이 정비사업을 말하고 있는가. 1차 필터의 나머지 절반. */
export function bodyMentionsRedev(body: string | null | undefined): boolean {
  return !!body && /(구역|정비사업)/.test(body);
}

/**
 * 본문에서 구역명 후보를 뽑는다.
 *
 * `범천1-1구역` · `사직5구역` · `광안A구역` 처럼 **구역으로 끝나는 토큰**을 집는다.
 * 앞의 한글·숫자·하이픈만 받아 문장이 통째로 딸려오지 않게 한다.
 *
 * ⚠️ 여기서 뽑은 값은 **정확 일치**에만 쓴다. 부분 일치로 쓰면 안 된다.
 */
export function extractZoneNames(body: string): string[] {
  const out = new Set<string>();

  // ① ○○구역 — 구역 앞 2~20자 (한글·영문 1자·숫자·하이픈·점)
  for (const m of body.matchAll(/([가-힣A-Za-z0-9][가-힣A-Za-z0-9.\-]{1,19}구역)/g)) {
    out.add(m[1]);
  }
  // ② ○○ 주택재개발정비사업 / ○○ 재건축정비사업 — 사업명 앞 토막
  for (const m of body.matchAll(/([가-힣A-Za-z0-9][가-힣A-Za-z0-9.\-]{1,19})\s*(?:주택)?(?:재개발|재건축)정비사업/g)) {
    out.add(m[1]);
  }

  return [...out]
    // '해당구역' '본구역' 같은 지시어는 현장 이름이 아니다.
    .filter((z) => !/^(해당|본|동|서|남|북|상기|각|전체|사업)구역$/.test(z))
    .slice(0, 12);
}

export type MatchOutcome =
  | { kind: 'discard'; reason: string }
  | { kind: 'queue'; reason: string; zones: string[] }
  | { kind: 'auto'; siteId: string; siteSlug: string; siteName: string; zone: string };

export interface CandidateSite {
  id: string;
  slug: string;
  name: string;
  builder: string | null;
  name_variants: unknown;
}

/** 표기 흔들림만 걷어낸다. 토막을 잘라내지 않는다 — 그건 부분 일치가 된다. */
export function normalizeName(v: string): string {
  return v.replace(/\s+/g, '').replace(/[()（）［］\[\]]/g, '').toLowerCase();
}

function variantsOf(site: CandidateSite): string[] {
  const raw = Array.isArray(site.name_variants) ? site.name_variants : [];
  return raw.filter((v): v is string => typeof v === 'string');
}

/**
 * 구역명 ↔ 현장 매칭. **정확 일치만** 인정한다.
 * 시공사까지 맞아떨어질 때만 auto, 아니면 queue.
 */
export function matchSite(
  zones: string[],
  corpName: string,
  candidates: CandidateSite[],
): MatchOutcome {
  const corp = normalizeName(corpName);
  const zoneSet = new Map(zones.map((z) => [normalizeName(z), z]));

  const nameHits: Array<{ site: CandidateSite; zone: string }> = [];
  for (const site of candidates) {
    const keys = [site.name, ...variantsOf(site)].map(normalizeName);
    for (const k of keys) {
      const zone = zoneSet.get(k);
      if (zone) {
        nameHits.push({ site, zone });
        break;
      }
    }
  }

  if (nameHits.length === 0) {
    return { kind: 'queue', reason: 'no_exact_zone_match', zones };
  }
  // 같은 구역명에 현장이 여럿이면 어느 쪽인지 알 수 없다. 고르지 않는다.
  if (nameHits.length > 1) {
    return { kind: 'queue', reason: 'multiple_zone_matches', zones };
  }

  const { site, zone } = nameHits[0];
  const builder = normalizeName(site.builder ?? '');
  if (!builder) return { kind: 'queue', reason: 'site_has_no_builder', zones };
  if (builder !== corp) return { kind: 'queue', reason: 'builder_mismatch', zones };

  return { kind: 'auto', siteId: site.id, siteSlug: site.slug, siteName: site.name, zone };
}
