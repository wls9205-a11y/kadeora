/**
 * H5-2 — 부동산 홈 2단의 데이터.
 *
 *   위 덩어리 opened   : «모집공고일» 기준 최신 (B6, 2026-08-28)
 *   아래 덩어리 pipeline: 곧 나올 현장 (공고 전)
 *
 * ⚠️ H5-2 때는 `announcement_date` 가 2,853건 null 이라 접수일(rcept_bgnde)로 두고
 *    라벨도 「접수일 기준」이라 적었다 — 라벨만 바꾸면 «다른 날짜를 모집공고일이라
 *    말하는 화면» 이 되기 때문이다. T1 백필이 끝나 2,855/2,855 채워졌고(null 0),
 *    형식도 전부 YYYY-MM-DD 라 B6 에서 «키와 라벨을 같이» 바꿨다.
 * ⚠️ 접수일은 버리지 «않는다». 카드 2줄에 「접수 8.10」으로 같이 낸다 — 공고일과
 *    접수일은 서로 다른 정보이고, 사람이 챙기는 것은 접수일이다.
 */

import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export interface RegionBlockItem {
  block: 'opened' | 'pipeline';
  id: string;
  slug: string | null;
  name: string;
  display_name: string | null;
  region: string | null;
  sigungu: string | null;
  total_units: number | null;
  lifecycle_stage: string | null;
  content_score: number | null;
  cover_image_url: string | null;
  hero_image_url: string | null;
  rcept_bgnde: string | null;
  rcept_endde: string | null;
  /** 모집공고일. B6 부터 위 덩어리의 «정렬 기준» 이다. ⚠️ DB 타입이 text 다. */
  announcement_date: string | null;
  stage_updated_at: string | null;
}

export interface RegionBlocks {
  opened: RegionBlockItem[];
  pipeline: RegionBlockItem[];
}

const EMPTY: RegionBlocks = { opened: [], pipeline: [] };
const REVALIDATE = 900;

async function fetchBlocks(region: string, sigungu: string | null): Promise<RegionBlocks> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_apt_region_blocks', {
      p_region: region,
      p_sigungu: sigungu,
      p_min_score: 40,
      p_limit: 40,
    });
    // ⛔ 조용히 빈 배열을 돌려주지 않는다. 이 저장소가 `if (!error)` 46곳으로 넉 달을 잃었다.
    if (error) {
      console.error(`[apt/region-blocks] ${region}/${sigungu ?? '전체'} — ${error.message?.slice(0, 200)}`);
      return EMPTY;
    }
    const rows = (data ?? []) as RegionBlockItem[];
    return {
      opened: rows.filter((r) => r.block === 'opened'),
      pipeline: rows.filter((r) => r.block === 'pipeline'),
    };
  } catch (e: any) {
    console.error('[apt/region-blocks] caught:', e?.message ?? String(e));
    return EMPTY;
  }
}

const cached = unstable_cache(fetchBlocks, ['apt-region-blocks'], {
  revalidate: REVALIDATE,
  tags: ['apt-hub'],
});

export function getRegionBlocks(region: string, sigungu?: string | null): Promise<RegionBlocks> {
  return cached(region, sigungu?.trim() || null);
}

/* ── 시도 타일 건수 ─────────────────────────────────────────────────────── */

export interface RegionCount { region: string; sigungu: string | null; cnt: number; is_region_total: boolean }

async function fetchCounts(): Promise<RegionCount[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_apt_region_counts', { p_min_score: 40 });
    if (error) {
      console.error(`[apt/region-counts] ${error.message?.slice(0, 200)}`);
      return [];
    }
    return (data ?? []) as RegionCount[];
  } catch (e: any) {
    console.error('[apt/region-counts] caught:', e?.message ?? String(e));
    return [];
  }
}

const cachedCounts = unstable_cache(fetchCounts, ['apt-region-counts'], {
  revalidate: REVALIDATE,
  tags: ['apt-hub'],
});

/**
 * 시도별 합계.
 *
 * ⚠️ `is_region_total` 을 «반드시» 봐야 한다. rollup 만으로는 「구군이 실제로 null 인
 *    현장 116곳」(서울 54 · 부산 41 …)과 「시도 소계 행」이 구분되지 않는다.
 *    이 플래그를 빼면 서울이 788 과 54 로 두 번 나온다.
 */
export async function getRegionTotals(): Promise<{ region: string; count: number }[]> {
  const rows = await cachedCounts();
  return rows
    .filter((r) => r.is_region_total && r.region)
    .map((r) => ({ region: r.region, count: Number(r.cnt) || 0 }))
    .sort((a, b) => b.count - a.count);
}

/** 선택 시도의 구군별 건수. 소계·총계 행은 뺀다. */
export async function getSigunguTotals(region: string): Promise<{ name: string; count: number }[]> {
  const rows = await cachedCounts();
  return rows
    .filter((r) => !r.is_region_total && r.region === region && r.sigungu)
    .map((r) => ({ name: r.sigungu as string, count: Number(r.cnt) || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
