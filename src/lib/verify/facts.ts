/**
 * PV-5a — 후검증 «판정만» 한다 (§6 verify-facts · D4 · D6).
 *
 * ── 이 파일이 지키는 한 문장 ────────────────────────────────────────────────
 * ⛔ **「독립 출처」는 매체 «수» 가 아니라 원출처 «수» 다.**
 *    같은 보도자료를 받아쓴 기사 12개는 출처 «1개» 다. 그걸 12로 세면
 *    조합이 흘린 미확정 수치가 하루 만에 `verified` 로 승격된다 —
 *    그리고 그 값이 §7-1 의 「확정 표기」를 얻는다.
 *
 * ⚠️ Rule #116. 판정만 한다. 네이버 검색·AI 추출·DB 쓰기는 라우트가 한다.
 * ⛔ D4 경계: 자동 반영은 display_name·name_variants·builder «만». 세대수·가격·
 *    lifecycle_stage·slug 는 verified 여도 «검수 큐» 로 간다. 이 파일은 그 경계를
 *    `autoApplicable()` 로 못박는다.
 */

/** D6 어휘 5값 — DB 제약(apt_sites_confidence_chk)과 «같은» 목록이다. */
export type Confidence = 'rumor' | 'estimated' | 'confirmed' | 'verified' | 'conflicting';

/**
 * 원출처의 «종류». 여기가 독립성의 기준이다.
 * ⚠️ 언론은 몇 곳이 받아써도 원출처 하나다 — 그래서 press 는 «통째로 1» 로 접힌다.
 */
export type OriginKind =
  | 'disclosure'   // 전자공시(DART) 등 — 가장 강함
  | 'union'        // 조합 공고·총회 자료
  | 'builder'      // 시공사 공식 발표·분양 페이지
  | 'announcement' // 입주자모집공고(청약홈)
  | 'permit'       // 인허가(건축HUB)
  | 'press';       // 언론 — 몇 건이든 «묶어서 1»

export interface Claim {
  /** 이 출처가 말한 값. 정규화는 호출자가 한다(세대수는 숫자, 이름은 문자열). */
  value: string | number | null;
  kind: OriginKind;
  /** 같은 종류 안에서 «다른 원출처» 를 가르는 키. 공시번호·공고번호·시공사명 등. */
  originKey?: string | null;
  url?: string | null;
  /** YYYY-MM-DD. 같은 값이 여러 번 나오면 «가장 이른» 것을 근거일로 쓴다. */
  publishedAt?: string | null;
}

export interface FieldVerdict {
  confidence: Confidence;
  /** 합의된 값. conflicting 이면 null — 억지로 하나 고르지 않는다. */
  value: string | number | null;
  /** 독립 «원출처» 수. 매체 수가 아니다. */
  independentSources: number;
  /** 판정 근거 한 줄. confidence_note 로 그대로 나간다(§7-1 근거 표기). */
  note: string;
  /** 값이 갈렸을 때 무엇과 무엇이 갈렸는지. 검수 큐가 이걸 본다. */
  disagreement?: Array<{ value: string | number | null; sources: number }>;
}

const norm = (v: string | number | null | undefined) =>
  v === null || v === undefined ? '' : String(v).replace(/\s+/g, '').toLowerCase();

/**
 * 독립 원출처를 «센다».
 * · press 는 몇 건이든 통째로 1
 * · 나머지는 (kind, originKey) 조합으로 구분 — originKey 가 없으면 kind 하나로 접는다
 */
export function countIndependent(claims: Claim[]): number {
  const keys = new Set<string>();
  let hasPress = false;
  for (const c of claims) {
    if (c.kind === 'press') { hasPress = true; continue; }
    keys.add(`${c.kind}:${c.originKey ?? ''}`);
  }
  return keys.size + (hasPress ? 1 : 0);
}

/**
 * 한 «필드» 의 판정.
 *
 * 규칙 (D6):
 *   독립 원출처 2 이상이 «같은 값» → verified
 *   1개만                          → estimated
 *   값이 갈림                      → conflicting (값을 «고르지 않는다»)
 *   press 만이고 1개               → rumor  ← 받아쓴 기사뿐이면 소문이다
 *   근거 없음                      → rumor
 */
export function judgeField(claims: Claim[]): FieldVerdict {
  const usable = claims.filter((c) => norm(c.value) !== '');
  if (usable.length === 0) {
    return { confidence: 'rumor', value: null, independentSources: 0, note: '근거 없음' };
  }

  // 값별로 «독립 원출처» 를 센다. 같은 값을 12개 매체가 받아써도 press 는 1이다.
  const byValue = new Map<string, Claim[]>();
  for (const c of usable) {
    const k = norm(c.value);
    byValue.set(k, [...(byValue.get(k) ?? []), c]);
  }

  const scored = [...byValue.entries()]
    .map(([k, cs]) => ({ key: k, value: cs[0].value, sources: countIndependent(cs), claims: cs }))
    .sort((a, b) => b.sources - a.sources);

  const top = scored[0];
  const rival = scored[1];

  // ⛔ 값이 갈리면 «고르지 않는다». 1위가 더 많아도 conflicting 이다 —
  //    다수결로 사실을 정하지 않는다(a5 의 「2건 이상이면 null」과 같은 규율).
  if (rival) {
    return {
      confidence: 'conflicting',
      value: null,
      independentSources: countIndependent(usable),
      note: `값이 갈렸다 — ${scored.map((s) => `${s.value}(출처 ${s.sources})`).join(' vs ')}`,
      disagreement: scored.map((s) => ({ value: s.value, sources: s.sources })),
    };
  }

  const onlyPress = top.claims.every((c) => c.kind === 'press');
  if (top.sources >= 2) {
    return {
      confidence: 'verified',
      value: top.value,
      independentSources: top.sources,
      note: `독립 원출처 ${top.sources}곳 일치 (${[...new Set(top.claims.map((c) => c.kind))].join('·')})`,
    };
  }
  if (onlyPress) {
    // ⚠️ 매체가 12곳이어도 원출처 1이면 소문이다. 여기가 이 파일의 존재 이유다.
    return {
      confidence: 'rumor',
      value: top.value,
      independentSources: 1,
      note: `언론 ${top.claims.length}건이지만 원출처 1곳 — 받아쓰기다`,
    };
  }
  return {
    confidence: 'estimated',
    value: top.value,
    independentSources: 1,
    note: `단일 원출처 (${top.claims[0].kind})`,
  };
}

/**
 * D4 자동 반영 경계.
 * ⛔ verified 여도 세대수·가격·stage·slug 는 «자동으로 쓰지 않는다».
 *    slug 는 색인 자산이라 어떤 경우에도 불변이다.
 */
const AUTO_FIELDS = new Set(['display_name', 'name_variants', 'builder']);

export function autoApplicable(field: string, v: FieldVerdict): boolean {
  return AUTO_FIELDS.has(field) && v.confidence === 'verified';
}

// ── 큐 우선순위 (§6) ────────────────────────────────────────────────────────
export interface QueueSite {
  slug: string;
  /** 파워링크가 이 현장으로 «착지» 하는가. 돈이 나가는 자리라 먼저 본다. */
  adLanding?: boolean;
  /** 사람이 쓴 큐레이션 문구가 있는가 (실측 5건). */
  curated?: boolean;
  lifecycleStage?: string | null;
  stageSource?: string | null;
  /** source_ids 가 비었는가 — 근거 없이 서 있는 레코드다. */
  noSourceIds?: boolean;
  hasLead?: boolean;
}

export const QUEUE_TIERS = [
  'ad_landing',      // 1 파워링크 착지
  'curated',         // 2 큐레이션
  'pre_ann_urgent',  // 3 pre_announcement 중 seed:web · source_ids {} — §6 「1순위」
  'pre_ann',         // 4 나머지 pre_announcement
  'lead',            // 5 리드 발생 현장
  'rest',            // 6 나머지
] as const;
export type QueueTier = (typeof QUEUE_TIERS)[number];

export function queueTier(s: QueueSite): QueueTier {
  if (s.adLanding) return 'ad_landing';
  if (s.curated) return 'curated';
  if (s.lifecycleStage === 'pre_announcement') {
    const urgent = s.noSourceIds || (s.stageSource ?? '').startsWith('seed:web');
    return urgent ? 'pre_ann_urgent' : 'pre_ann';
  }
  if (s.hasLead) return 'lead';
  return 'rest';
}

export function queueRank(s: QueueSite): number {
  return QUEUE_TIERS.indexOf(queueTier(s));
}

/**
 * 큐 통계 + «언제 그 층에 닿는가».
 * ⚠️ 순차 큐는 앞 층이 두꺼우면 뒤 층을 굶긴다. 그 사실을 숫자로 내놓아야
 *    「분양예정을 29일 뒤에 본다」는 선택을 «의식하고» 할 수 있다.
 */
export function queueStats(sites: QueueSite[], perDay: number) {
  const counts = Object.fromEntries(QUEUE_TIERS.map((t) => [t, 0])) as Record<QueueTier, number>;
  for (const s of sites) counts[queueTier(s)]++;
  let cum = 0;
  return QUEUE_TIERS.map((t) => {
    const before = cum;
    cum += counts[t];
    return {
      tier: t,
      count: counts[t],
      startsAfter: before,
      daysToReach: perDay > 0 ? Math.ceil(before / perDay) : null,
      daysToClear: perDay > 0 ? Math.ceil(cum / perDay) : null,
    };
  });
}
