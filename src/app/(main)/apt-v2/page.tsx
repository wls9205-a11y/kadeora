/**
 * /apt-v2 (default = 청약 탭)
 *
 * 서버 컴포넌트. region 기반 데이터 fetch → SubscriptionTab 렌더.
 * (sb as any).from() 패턴 유지 (Architecture Rule #13).
 */

import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  PageHeader,
  CategoryTabs,
  SubscriptionTab,
} from '@/components/apt-tabs';
import {
  triggerMissingCoverResolution,
} from '@/lib/apt/resolveCoverImage';
import {
  dDayFrom,
} from '@/components/apt-tabs/utils';
import type {
  Region,
  Kpi,
  SubscriptionItem,
  AptSiteCover,
} from '@/components/apt-tabs/types';

export const revalidate = 600;

export const metadata: Metadata = {
  title: '청약 일정 모아보기 - 카더라',
  description: '진행 중인 청약 일정과 평균 가점, 마감 임박 단지를 한눈에.',
};

const DEFAULT_REGION_CODE = '1168011000'; // 강남구 압구정동

type SearchParams = {
  region?: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const regionCode = params.region ?? DEFAULT_REGION_CODE;

  const [region, kpis, items] = await Promise.all([
    fetchRegion(regionCode),
    fetchSubscriptionKpis(regionCode),
    fetchSubscriptionItems(regionCode),
  ]);

  // fire-and-forget: 사진 없는 단지의 카카오 위성뷰 백그라운드 resolve
  triggerMissingCoverResolution(items);

  return (
    <main className="aptr-root">
      <PageHeader region={region} kpis={kpis} />
      <CategoryTabs active="subscription" basePath="/apt-v2" />
      <SubscriptionTab items={items} myScore={65} />
    </main>
  );
}

/* ============================================================
 * Fetchers (Architecture Rule #13: (sb as any).from())
 * ============================================================ */

async function fetchRegion(regionCode: string): Promise<Region> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('regions')
      .select('code, name, parent_name')
      .eq('code', regionCode)
      .maybeSingle();

    if (data) {
      return {
        code: data.code,
        name: data.name ?? '압구정동',
        parentName: data.parent_name ?? '서울 강남구',
      };
    }
  } catch (err) {
    console.error('[apt-v2/region]', err);
  }
  return { code: regionCode, name: '압구정동', parentName: '서울 강남구' };
}

async function fetchSubscriptionKpis(regionCode: string): Promise<Kpi[]> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('apt_subscriptions')
      .select('id, expected_min_score, avg_price, status')
      .eq('region_code', regionCode)
      .in('status', ['accepting', 'upcoming']);

    const list = (data ?? []) as Array<{
      expected_min_score: number | null;
      avg_price: number | null;
    }>;

    const count = list.length;
    const avgScore =
      list.length > 0
        ? Math.round(
            list
              .filter((r) => typeof r.expected_min_score === 'number')
              .reduce((sum, r) => sum + (r.expected_min_score ?? 0), 0) /
              Math.max(1, list.filter((r) => typeof r.expected_min_score === 'number').length)
          )
        : 0;
    const avgPrice =
      list.length > 0
        ? Math.round(
            list
              .filter((r) => typeof r.avg_price === 'number')
              .reduce((sum, r) => sum + (r.avg_price ?? 0), 0) /
              Math.max(1, list.filter((r) => typeof r.avg_price === 'number').length)
          )
        : 0;

    return [
      { label: '진행 청약', value: `${count}` },
      { label: '평균 가점', value: avgScore ? `${avgScore}` : '-' },
      {
        label: '평균 분양가',
        value: avgPrice ? `${(avgPrice / 1e8).toFixed(1)}억` : '-',
      },
    ];
  } catch (err) {
    console.error('[apt-v2/kpis]', err);
    return [
      { label: '진행 청약', value: '-' },
      { label: '평균 가점', value: '-' },
      { label: '평균 분양가', value: '-' },
    ];
  }
}

async function fetchSubscriptionItems(regionCode: string): Promise<SubscriptionItem[]> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('apt_subscriptions')
      .select(
        `
        id,
        deadline,
        unit_count,
        unit_sizes,
        avg_price,
        expected_competition,
        expected_min_score,
        site:apt_sites (
          id, name,
          cover_image_url, cover_image_kind, cover_image_source, cover_image_blurhash
        )
      `
      )
      .eq('region_code', regionCode)
      .in('status', ['accepting', 'upcoming'])
      .order('deadline', { ascending: true })
      .limit(10);

    if (!data) return [];

    return (data as any[]).map((row) => ({
      id: String(row.id),
      site: normalizeSite(row.site, '단지'),
      dDay: dDayFrom(row.deadline),
      unitCount: row.unit_count ?? 0,
      unitSizes: row.unit_sizes ?? '-',
      avgPrice: row.avg_price ?? 0,
      expectedCompetition: row.expected_competition ?? 0,
      minScore: row.expected_min_score ?? undefined,
      href: `/apt/subscription/${row.id}`,
    }));
  } catch (err) {
    console.error('[apt-v2/items]', err);
    return [];
  }
}

function normalizeSite(raw: any, fallbackName: string): AptSiteCover {
  if (!raw) {
    return {
      id: 'unknown',
      name: fallbackName,
      cover_image_url: null,
      cover_image_kind: null,
    };
  }
  return {
    id: String(raw.id),
    name: raw.name ?? fallbackName,
    cover_image_url: raw.cover_image_url ?? null,
    cover_image_kind: raw.cover_image_kind ?? null,
    cover_image_source: raw.cover_image_source ?? null,
    cover_image_blurhash: raw.cover_image_blurhash ?? null,
  };
}
