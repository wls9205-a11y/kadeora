// 지역 셀렉 — 서버 조회. 「카운트는 실측값」 요구를 지키는 자리.

import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildRegionCounts, type RegionCountRow, type RegionCounts } from '@/lib/region/select-counts';
import { sigunguNodeOfCode } from '@/lib/region/select-tree';
import { parseRegionSigungu } from '@/lib/region/lawd';
import { UPCOMING_SALE_STAGES, OPEN_SALE_STAGES } from '@/lib/apt/lifecycle-label';

const EMPTY: RegionCounts = {
  bySigunguLabel: new Map(), bySidoCode: new Map(),
  nationwide: { upcoming: 0, open: 0 }, orphan: { upcoming: 0, open: 0 },
};

async function fetchRows(): Promise<RegionCountRow[]> {
  try {
    const sb = getSupabaseAdmin();
    // ⚠️ 집계 RPC 다. 원행(1,481)을 그대로 받으면 PostgREST 캡 1,000 에 잘리고,
    //    잘린 0 은 「그 지역에 없다」와 구분되지 않는다.
    const { data, error } = await (sb as any).rpc('fn_region_sale_counts');
    if (error) {
      console.error('[region/counts] rpc error:', JSON.stringify(error).slice(0, 200));
      return [];
    }
    return (data ?? []) as RegionCountRow[];
  } catch (e: any) {
    console.error('[region/counts] caught:', e?.message ?? String(e));
    return [];
  }
}

const cached = unstable_cache(fetchRows, ['region-sale-counts'], { revalidate: 900, tags: ['apt-hub'] });

/**
 * ⚠️ 실패하면 «0 으로 채운 표» 를 돌려준다. 화면은 「분양예정 0」을 보여주게 되는데,
 *    그건 「없다」가 아니라 「못 셌다」다 — 로그에 남기고, 셀렉은 그래도 열리게 둔다.
 *    ⛔ 여기서 throw 하면 목록 화면 전체가 죽는다. 셀렉은 목록의 부속이다.
 */
export async function getRegionCounts(): Promise<RegionCounts> {
  const rows = await cached();
  if (!rows.length) return EMPTY;
  return buildRegionCounts(rows);
}

/** 선택 코드 → DB 조회에 쓸 (region, sigungu) 쌍. 중복은 접는다. */
export function selectionToPairs(codes: readonly string[]): Array<{ region: string; sigungu: string }> {
  const seen = new Set<string>();
  const out: Array<{ region: string; sigungu: string }> = [];
  for (const c of codes) {
    const node = sigunguNodeOfCode(c);
    if (!node) continue;
    if (seen.has(node.label)) continue;
    seen.add(node.label);
    const { region, sigungu } = parseRegionSigungu(node.label);
    out.push({ region, sigungu });
  }
  return out;
}

export interface SelectedSite {
  slug: string | null;
  name: string;
  display_name: string | null;
  region: string | null;
  sigungu: string | null;
  lifecycle_stage: string | null;
  total_units: number | null;
  expected_sale_period: string | null;
}

/**
 * 선택한 지역의 «분양예정·분양중» 현장.
 *
 * ⚠️ 시군구 문자열이 라벨과 어긋나는 행이 있다(세종 4변형 · 제주 읍면 · 빈 값 78건).
 *    그래서 시군구까지 좁히지 «않고» 시도로 받아 시군구를 코드 축에서 다시 거른다 —
 *    반대로 하면 표기가 다른 현장이 조용히 사라진다.
 */
export async function getSitesForSelection(codes: readonly string[], limit = 60): Promise<SelectedSite[]> {
  const pairs = selectionToPairs(codes);
  if (!pairs.length) return [];
  const regions = [...new Set(pairs.map((p) => p.region))];
  const wanted = new Set(pairs.map((p) => `${p.region} ${p.sigungu}`.trim()));
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any)
      .from('apt_sites')
      .select('slug, name, display_name, region, sigungu, lifecycle_stage, total_units, expected_sale_period')
      .eq('is_active', true)
      .in('region', regions)
      .in('lifecycle_stage', [...UPCOMING_SALE_STAGES, ...OPEN_SALE_STAGES])
      .order('expected_sale_sort', { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) {
      console.error('[region/sites] error:', JSON.stringify(error).slice(0, 200));
      return [];
    }
    const rows = (data ?? []) as SelectedSite[];
    return rows
      .filter((r) => wanted.has(`${r.region ?? ''} ${r.sigungu ?? ''}`.trim()))
      .slice(0, limit);
  } catch (e: any) {
    console.error('[region/sites] caught:', e?.message ?? String(e));
    return [];
  }
}
