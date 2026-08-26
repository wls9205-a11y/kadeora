// H4-4 §5 — 기축 실거래 «활동». 시세표가 아니다.
//
// ── 왜 「시세」라고 부르지 않는가 ──
// 단지 «전체» 평균가와 그 변동률을 쓰지 않기로 했다. 평형 구성이 바뀌면 그게
// 가격 변동으로 위장되기 때문이다. 실측(e편한세상송도더퍼스트비치 · 부산 서구):
//
//   월     단지 전체 평균   84㎡    59㎡    84㎡ 비중
//   5월    4.78억          5.80    4.15    38%
//   6월    5.34억 (+11.7%) 5.84    4.01    60%
//
// 전체 평균이 +11.7% 올랐는데 두 평형은 제자리이거나 «떨어졌다». 움직인 건 구성비뿐이다.
// 부울경 (단지,평형) 586 계열 중 140건(23.9%)에서 이 부호가 실제로 뒤집힌다.
//
// → 그래서 이 섹션은 **거래 건수와 최근 거래일을 주고**, 가격은 «평형을 고정했을 때만» 낸다.
//   RPC 가 최다 거래 평형 하나를 골라 주고, 표본이 모자라면 가격 필드를 통째로 NULL 로 준다.
//   실측 연결 645곳 중 가격이 붙는 건 350곳(54%)뿐이다. 나머지는 «가격 없음» 이 정상이다.
//
// ⚠️ `apt_complex_profiles.price_change_1y` 를 여기서 쓰지 않는다. 그 값을 만드는
//    `calc_apt_price_change_1y()` 는 `GROUP BY t.apt_name` 하나뿐이라 평형도 시군구도 없다
//    (이름 1,833개가 복수 시군구에 걸쳐 거래 22%가 섞인다). 별도 트랙에서 고친다.

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { BUGYEONG, BUGYEONG_REGIONS } from '@/lib/apt/pipeline';

export interface GichukRow {
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  /** 조회 기간(기본 180일) 거래 건수. 이 섹션의 «주» 신호다. */
  deals: number;
  lastDealDate: string | null;
  /** 가격을 낸 평형(㎡). null 이면 아래 세 값도 전부 null 이다. */
  areaM2: number | null;
  /** 그 평형의 거래 건수. 가격이 몇 건에서 나온 값인지 밝히는 데 쓴다. */
  areaDeals: number | null;
  /** 만원 단위. 평형 고정 평균. */
  priceAvg: number | null;
  priceMin: number | null;
  priceMax: number | null;
}

/**
 * `/apt` 의 지역 규칙을 RPC 인자로 옮긴다.
 *
 * ⚠️ 페이지의 다른 섹션(공고 전 현장·최근 움직인 현장)과 «같은 지역» 을 말해야 한다.
 *    한 화면에서 섹션마다 다른 지역을 보여주면 사용자가 무엇을 보고 있는지 모른다.
 */
export function gichukRegions(pipelineRegion: string): string[] {
  return pipelineRegion === BUGYEONG ? [...BUGYEONG_REGIONS] : [pipelineRegion];
}

/** 만원 → 억. `59441` → `5.9억`. price_min/max 와 같은 단위다. */
export function eok(manwon: number | null | undefined): string {
  if (manwon == null || !Number.isFinite(manwon) || manwon <= 0) return '';
  return `${Math.round((manwon / 10000) * 10) / 10}억`;
}

/** `84.9` → `85㎡`. 소수 첫째 자리는 버린다 — 칩에서 `84.9㎡` 는 길고 의미가 없다. */
export function areaLabel(m2: number | null | undefined): string {
  if (m2 == null || !Number.isFinite(m2) || m2 <= 0) return '';
  return `${Math.round(m2)}㎡`;
}

/** `2026-08-18` → `8/18`. */
export function dealDateLabel(iso: string | null | undefined): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}` : '';
}

/**
 * 가격을 렌더해도 되는가.
 *
 * ⚠️ 평형을 모르면 «가격도 쓰지 않는다». 평형 없는 가격은 단지 전체 평균과 구분되지 않고,
 *    그게 이 섹션이 존재하는 이유를 통째로 무너뜨린다. 네 값이 다 있을 때만 참이다.
 */
export function hasQuotablePrice(r: GichukRow): boolean {
  return r.areaM2 != null && r.areaM2 > 0
    && r.areaDeals != null && r.areaDeals > 0
    && r.priceAvg != null && r.priceAvg > 0;
}

/**
 * RPC 한 번. p_days·p_min_deals·p_limit 는 기본값을 쓴다 — 프런트가 창을 바꾸면
 * 화면 숫자와 RPC 의 표본 기준이 어긋난다.
 *
 * ⚠️ 실패를 조용히 삼키지 않는다. 빈 배열을 내되 console.error 는 남긴다.
 * ⚠️ /apt 본체 Promise.all 에 «합치지 않는다» (Rule #49). 호출부가 분리해 돌린다.
 */
export async function fetchGichukActivity(pipelineRegion: string): Promise<GichukRow[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_gichuk_trade_activity', {
      p_regions: gichukRegions(pipelineRegion),
    });
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    return rows
      .map((r: Record<string, any>) => ({
        slug: String(r.slug ?? ''),
        name: String(r.name ?? '').trim(),
        region: r.region ?? null,
        sigungu: r.sigungu ?? null,
        deals: Number(r.deals ?? 0),
        lastDealDate: r.last_deal_date ?? null,
        areaM2: r.area_m2 == null ? null : Number(r.area_m2),
        areaDeals: r.area_deals == null ? null : Number(r.area_deals),
        priceAvg: r.price_avg == null ? null : Number(r.price_avg),
        priceMin: r.price_min == null ? null : Number(r.price_min),
        priceMax: r.price_max == null ? null : Number(r.price_max),
      }))
      // slug 가 없으면 상세로 보낼 곳이 없다. 링크 없는 행을 목록에 남기지 않는다.
      .filter((r: GichukRow) => r.slug && r.name && r.deals > 0);
  } catch (e) {
    console.error('[apt] gichuk activity failed:', e);
    return [];   // 실패해도 /apt 나머지는 그대로 뜬다
  }
}
