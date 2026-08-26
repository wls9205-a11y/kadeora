// M5 §B — 홈 섹션 데이터.
//
// 「지금 계약 가능한 현장」 하나뿐이라 정보가 얇았다. 네 섹션을 «같은 줄 구조» 로 낸다.
// 카드는 104px, 텍스트 줄은 42px — 같은 자리에 세 배가 들어간다.
//
// ⚠️ 홈의 모든 현장 쿼리에 지역 필터가 걸려 있어야 한다. 필터가 없어 경기 현장이
//    홈 상단에 뜬 전례가 있다(C-5).
// ⚠️ .limit() 을 반드시 준다. supabase-js 기본 상한이 1,000행이라 빼면 조용히 잘린다.

import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** 한 섹션이 이 수보다 적으면 섹션 자체를 감춘다 (M5 §B-5). */
export const MIN_ROWS = 3;

export interface HomeRow {
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  lifecycle_stage: string | null;
  total_units: number | null;
  /** 렌더해도 되는 가격만 담는다. 가짜 값이면 null 로 비운다 (§B-4 ①). */
  price: { min: number; max: number } | null;
  /** 「많이 보는 현장」에만 붙는다. */
  rank?: number;
  /**
   * H4-1 (f) — 실사 승격 후보. «조감도·시행사 제공분만» 담는다.
   *
   * ⚠️ `satellite_image_url` 을 여기 담지 않는다 (2026-08-25 이미지 정책).
   *    준공 전 현장에 위성을 깔면 아직 없는 건물 자리의 공터가 보인다.
   * ⚠️ 라이선스 판정은 렌더하는 쪽에서 canUseHeroImage() 로 한다 —
   *    tier 를 같이 실어 보내는 이유다. 판정을 여기서 미리 하지 않는 건
   *    화면마다 leadContext 가 다르기 때문이다(홈은 리드폼이 없다).
   */
  hero_image_url: string | null;
  hero_license_tier: string | null;
}

/**
 * §B-4 ② — 현장이 아닌 «공고문» 을 걸러낸다.
 *
 * `2020.2.7. LH 국민임대 예비입주자 모집공고` 가 조회수 9위였다. 현장이 아니라 공고다.
 *
 * ⚠️ 광고 키워드 필터의 `length(name) >= 6` 은 «가져오지 않는다».
 *    그건 짧은 이름이 검색어로 모호하다는 이유의 규칙이고, 목록에 쓰면
 *    `레이카운티`(5자 · 조회수 3위) 같은 실존 대단지가 날아간다.
 *    5자 미만이면서 조회수가 있는 현장이 209곳이다.
 */
const NOT_A_SITE = /임대|행복주택|사전청약|모집|공공분양|희망타운|분양전환|리츠|^[0-9]/;

export function isRealSite(name: string | null | undefined): boolean {
  const n = (name ?? '').trim();
  return n.length >= 2 && !NOT_A_SITE.test(n);
}

/** 정비사업 계열 — 분양가가 확정되지 않은 단계다. */
const REDEV_STAGES = new Set([
  'site_planning', 'union_established', 'constructor_selected',
  'plan_approved', 'mgmt_approved', 'construction',
]);

/**
 * §B-4 ① — 가짜 분양가 차단.
 *
 * 지역 평균을 채워 넣은 값이 단지별 정보인 척 붙어 있다. 실측(부울경):
 *   20800~55500  58곳 · 10500~27800  35곳 · 17800~48000  31곳   = 124곳
 * 이 값들은 정비사업뿐 아니라 post_move_in · move_in_ready · unsold_active 에도 걸쳐 있어
 * 「정비사업이면 숨긴다」만으로는 부족하다.
 *
 * 판정: 같은 (min,max) 가 **3곳 이상** AND **3단계 이상** 에 걸쳐 있으면 채움값이다.
 * ⚠️ 3곳 기준만 쓰면 311곳이 잘린다 — 과하다. 단일 단계에 같은 값인 것
 *    (11000~11000 이 post_move_in 9곳 등)은 실제 평균가일 수 있어 살린다.
 */
export function buildFakePriceSet(
  rows: { price_min: number | null; price_max: number | null; lifecycle_stage: string | null }[],
): Set<string> {
  const tally = new Map<string, { n: number; stages: Set<string> }>();
  for (const r of rows) {
    if (r.price_min == null || r.price_max == null) continue;
    const key = `${r.price_min}|${r.price_max}`;
    const cur = tally.get(key) ?? { n: 0, stages: new Set<string>() };
    cur.n += 1;
    cur.stages.add(r.lifecycle_stage ?? '');
    tally.set(key, cur);
  }
  const out = new Set<string>();
  for (const [key, v] of tally) if (v.n >= 3 && v.stages.size >= 3) out.add(key);
  return out;
}

/** 이 행의 가격을 렌더해도 되는가. */
export function priceOf(
  row: { price_min: number | null; price_max: number | null; lifecycle_stage: string | null },
  fake: Set<string>,
): HomeRow['price'] {
  const { price_min: lo, price_max: hi, lifecycle_stage: st } = row;
  if (lo == null || hi == null || lo <= 0) return null;
  // 정비사업은 분양가가 확정되기 전이다. 숫자가 있어도 그건 확정가가 아니다.
  if (REDEV_STAGES.has(st ?? '')) return null;
  if (fake.has(`${lo}|${hi}`)) return null;
  return { min: lo, max: hi };
}

const COLS = 'slug,name,region,sigungu,lifecycle_stage,total_units,price_min,price_max,page_views,content_score,hero_image_url,hero_license_tier';

type Raw = {
  slug: string; name: string; region: string | null; sigungu: string | null;
  lifecycle_stage: string | null; total_units: number | null;
  price_min: number | null; price_max: number | null;
  page_views: number | null; content_score: number | null;
  hero_image_url: string | null; hero_license_tier: string | null;
};

export interface HomeSections {
  popular: HomeRow[];
  deals: HomeRow[];
  redev: HomeRow[];
}

/**
 * 세 섹션을 «한 번의 조회» 로 낸다.
 *
 * ⚠️ 가짜 가격 판정에는 모집단 전체가 필요하다(3곳·3단계를 세야 한다).
 *    섹션별로 5줄씩만 읽으면 셀 수가 없다. 그래서 부울경 활성 현장을 한 번에 읽고
 *    JS 에서 가른다 — fetchCounts 가 이미 같은 크기를 읽고 있어 부담이 늘지 않는다.
 */
export async function fetchHomeSections(regions: string[]): Promise<HomeSections> {
  const empty: HomeSections = { popular: [], deals: [], redev: [] };
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any)
      .from('apt_sites')
      .select(COLS)
      .eq('is_active', true)
      .in('region', regions)
      .limit(5000);
    if (error) throw error;

    const rows = ((data ?? []) as Raw[]).filter((r) => isRealSite(r.name));
    const fake = buildFakePriceSet(rows);
    const toRow = (r: Raw, rank?: number): HomeRow => ({
      slug: r.slug, name: r.name, region: r.region, sigungu: r.sigungu,
      lifecycle_stage: r.lifecycle_stage, total_units: r.total_units,
      price: priceOf(r, fake),
      hero_image_url: r.hero_image_url ?? null,
      hero_license_tier: r.hero_license_tier ?? null,
      ...(rank ? { rank } : {}),
    });

    // ⚠️ H4-1 (e) — popular 는 «홈에서 렌더하지 않는다». page_views 가 합성값이라
    //    정렬 근거가 없다(컬럼 총합 200,655 대 실조회 1,941). 계산은 남겨 뒀다 —
    //    다른 소비처가 생길 수 있고, 지우면 이 판정 기록도 같이 사라진다.
    //    되살리려면 정렬 근거부터 만들어야 한다 (H4-3 계측 → 승격 판정).
    const popular = rows
      .filter((r) => (r.page_views ?? 0) > 0)
      .sort((a, b) => (b.page_views ?? 0) - (a.page_views ?? 0))
      .slice(0, 5)
      .map((r, i) => toRow(r, i + 1));

    const deals = rows
      .filter((r) => r.lifecycle_stage === 'unsold_active')
      .sort((a, b) => (b.content_score ?? 0) - (a.content_score ?? 0)
        || (b.total_units ?? 0) - (a.total_units ?? 0))
      .slice(0, 3)
      .map((r) => toRow(r));

    const redev = rows
      .filter((r) => REDEV_STAGES.has(r.lifecycle_stage ?? ''))
      .sort((a, b) => (b.content_score ?? 0) - (a.content_score ?? 0)
        || (b.total_units ?? 0) - (a.total_units ?? 0))
      .slice(0, 3)
      .map((r) => toRow(r));

    return { popular, deals, redev };
  } catch (e) {
    console.error('[home] sections failed:', e);
    return empty;   // 실패해도 검색창·지역 칩은 그대로 뜬다
  }
}
