// v5-V3 — /apt/archive 데이터 레이어.
//
// 역할 분담: /apt 허브 = 최근(60/180/365 사다리) · /apt/archive = 그 이전 전부.
//
// get_apt_archive RPC 한 방으로 끝난다 (Architecture Rule #49).
// 페이지가 searchParams 를 읽어 dynamic 으로 강등되므로 page-level revalidate 는
// 무력하다 — hub.ts 와 같이 데이터 레이어에서 unstable_cache 를 직접 건다.
// 결과가 비면 캐시에 넣지 않고 그대로 반환한다 (Rule #66 — 빈 응답 영구화 회피).

import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const APT_ARCHIVE_REVALIDATE_SECONDS = 900;

/** RPC 가 클램프하지만 의도를 맞춰 프론트에서도 지킨다. */
export const ARCHIVE_PAGE_SIZE = 20;
export const ARCHIVE_MAX_PAGE_SIZE = 50;

export type ArchiveSort = 'recent' | 'competition' | 'households';
export const ARCHIVE_SORTS: { key: ArchiveSort; label: string }[] = [
  { key: 'recent', label: '최근순' },
  { key: 'competition', label: '경쟁률순' },
  { key: 'households', label: '세대수순' },
];

export function normalizeSort(v?: string | null): ArchiveSort {
  return v === 'competition' || v === 'households' ? v : 'recent';
}

/**
 * 아카이브 항목. **허브(AptHubItem)와 규격이 같은 부분만** 쓴다 —
 * 같은 .kd-lrow 행 컴포넌트를 그대로 재사용하기 위해서다.
 * 허브에 있고 여기 없는 필드(dday·weight·min_score·특별공급/계약 일자)는
 * 마감된 공고라 의미가 없어 RPC 가 내려주지 않는다.
 */
export interface AptArchiveItem {
  id: number;
  house_manage_no: string | null;
  house_nm: string | null;
  region_nm: string | null;
  supply_addr: string | null;
  households: number | null;
  price_per_pyeong: number | null;
  rcept_bgnde: string | null;
  rcept_endde: string | null;
  przwner_presnatn_de: string | null;
  competition_rate: number | null;
  total_applicants: number | null;
  pblanc_url: string | null;
  site_slug: string | null;
  thumb_url: string | null;
  builder: string | null;
  status: 'closed';
}

export interface AptArchiveYear {
  year: number;
  cnt: number;
}

export interface AptArchivePayload {
  region: string;
  year: number | null;
  sort: ArchiveSort;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  years: AptArchiveYear[];
  items: AptArchiveItem[];
}

export const EMPTY_ARCHIVE: AptArchivePayload = {
  region: '전국',
  year: null,
  sort: 'recent',
  page: 1,
  page_size: ARCHIVE_PAGE_SIZE,
  total: 0,
  total_pages: 0,
  years: [],
  items: [],
};

function normalize(raw: unknown, fallback: Partial<AptArchivePayload>): AptArchivePayload {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ARCHIVE, ...fallback };
  const r = raw as Partial<AptArchivePayload>;
  return {
    region: r.region ?? fallback.region ?? '전국',
    year: typeof r.year === 'number' ? r.year : null,
    sort: normalizeSort(r.sort),
    page: Number(r.page) > 0 ? Number(r.page) : 1,
    page_size: Number(r.page_size) > 0 ? Number(r.page_size) : ARCHIVE_PAGE_SIZE,
    total: Number(r.total) || 0,
    total_pages: Number(r.total_pages) || 0,
    years: Array.isArray(r.years) ? (r.years as AptArchiveYear[]) : [],
    items: Array.isArray(r.items) ? (r.items as AptArchiveItem[]) : [],
  };
}

async function fetchArchiveUncached(
  region: string,
  year: number | null,
  sort: ArchiveSort,
  page: number,
): Promise<AptArchivePayload> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_apt_archive', {
      p_region: region,
      p_year: year,
      p_sort: sort,
      p_page: page,
      // RPC 가 1~50 으로 클램프하지만 초과값을 보내지 않는다 (의도를 맞춘다).
      p_page_size: Math.min(ARCHIVE_PAGE_SIZE, ARCHIVE_MAX_PAGE_SIZE),
    });
    if (error) {
      console.error('[apt/archive] rpc error:', JSON.stringify(error));
      return { ...EMPTY_ARCHIVE, region, year, sort, page };
    }
    const payload = normalize(data, { region, year, sort, page });
    console.log(
      `[apt/archive] region=${region} year=${year ?? 'all'} sort=${sort} ` +
        `page=${page}/${payload.total_pages} total=${payload.total}`,
    );
    return payload;
  } catch (e: any) {
    console.error('[apt/archive] caught:', e?.message ?? String(e));
    return { ...EMPTY_ARCHIVE, region, year, sort, page };
  }
}

export async function getAptArchive(
  region: string,
  year: number | null,
  sort: ArchiveSort,
  page: number,
): Promise<AptArchivePayload> {
  const key = `apt-archive:${region}:${year ?? 'all'}:${sort}:${page}`;
  const cached = unstable_cache(
    () => fetchArchiveUncached(region, year, sort, page),
    [key],
    { revalidate: APT_ARCHIVE_REVALIDATE_SECONDS, tags: ['apt-archive'] },
  );
  const payload = await cached();
  // Rule #66 — 빈 결과가 캐시에 굳지 않도록 그 자리에서 한 번 더 직접 조회한다.
  if (payload.total === 0 && payload.items.length === 0) {
    return fetchArchiveUncached(region, year, sort, page);
  }
  return payload;
}
