/**
 * /apt-v2/unsold
 */

import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  PageHeader,
  CategoryTabs,
  UnsoldTab,
} from '@/components/apt-tabs';
import { triggerMissingCoverResolution } from '@/lib/apt/resolveCoverImage';
import type {
  Region,
  Kpi,
  UnsoldItem,
  UnsoldTrendPoint,
  AptSiteCover,
} from '@/components/apt-tabs/types';

export const revalidate = 600;

export const metadata: Metadata = {
  title: '미분양 잔여 - 카더라',
  description: '미분양 단지와 할인 혜택을 한눈에.',
};

const DEFAULT_REGION_CODE = '1168011000';

type SearchParams = { region?: string };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const regionCode = params.region ?? DEFAULT_REGION_CODE;

  const [region, kpis, items, trend] = await Promise.all([
    fetchRegion(regionCode),
    fetchUnsoldKpis(regionCode),
    fetchUnsoldItems(regionCode),
    fetchUnsoldTrend(regionCode),
  ]);

  triggerMissingCoverResolution(items);

  return (
    <main className="aptr-root">
      <PageHeader region={region} kpis={kpis} />
      <CategoryTabs active="unsold" basePath="/apt-v2" />
      <UnsoldTab items={items} trendData={trend} />
    </main>
  );
}

/* ============================================================ */

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
    console.error('[apt-v2/unsold/region]', err);
  }
  return { code: regionCode, name: '압구정동', parentName: '서울 강남구' };
}

async function fetchUnsoldKpis(regionCode: string): Promise<Kpi[]> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('apt_unsold')
      .select('remaining_units, discount_pct')
      .eq('region_code', regionCode)
      .gt('remaining_units', 0);

    const list = (data ?? []) as Array<{
      remaining_units: number | null;
      discount_pct: number | null;
    }>;
    const count = list.length;
    const maxDiscount =
      list.length > 0
        ? Math.max(...list.map((r) => r.discount_pct ?? 0))
        : 0;

    return [
      { label: '미분양', value: `${count}`, deltaTone: 'negative' },
      { label: '최대 할인', value: maxDiscount ? `${maxDiscount}%` : '-' },
    ];
  } catch (err) {
    console.error('[apt-v2/unsold/kpis]', err);
    return [
      { label: '미분양', value: '-' },
      { label: '최대 할인', value: '-' },
    ];
  }
}

async function fetchUnsoldItems(regionCode: string): Promise<UnsoldItem[]> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('apt_unsold')
      .select(
        `
        id, remaining_units, unit_sizes, original_price, current_price, discount_pct, benefits,
        site:apt_sites (id, name, cover_image_url, cover_image_kind, cover_image_source, cover_image_blurhash)
      `
      )
      .eq('region_code', regionCode)
      .gt('remaining_units', 0)
      .order('discount_pct', { ascending: false })
      .limit(10);

    if (!data) return [];

    return (data as any[]).map((row) => ({
      id: String(row.id),
      site: normalizeSite(row.site),
      remainingUnits: row.remaining_units ?? 0,
      unitSizes: row.unit_sizes ?? '-',
      originalPrice: row.original_price ?? 0,
      currentPrice: row.current_price ?? 0,
      discountPct: row.discount_pct ?? 0,
      benefits: Array.isArray(row.benefits) ? row.benefits : [],
      href: `/apt/unsold/${row.id}`,
    }));
  } catch (err) {
    console.error('[apt-v2/unsold/items]', err);
    return [];
  }
}

async function fetchUnsoldTrend(regionCode: string): Promise<UnsoldTrendPoint[]> {
  const sb = getSupabaseAdmin();
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const { data } = await (sb as any)
      .from('apt_unsold_monthly')
      .select('month, count')
      .eq('region_code', regionCode)
      .gte('month', since.toISOString().slice(0, 7))
      .order('month', { ascending: true });

    if (!data) return [];
    return (data as any[]).map((row) => ({
      month: row.month,
      count: row.count ?? 0,
    }));
  } catch (err) {
    console.error('[apt-v2/unsold/trend]', err);
    return [];
  }
}

function normalizeSite(raw: any): AptSiteCover {
  if (!raw) {
    return {
      id: 'unknown',
      name: '단지',
      cover_image_url: null,
      cover_image_kind: null,
    };
  }
  return {
    id: String(raw.id),
    name: raw.name ?? '단지',
    cover_image_url: raw.cover_image_url ?? null,
    cover_image_kind: raw.cover_image_kind ?? null,
    cover_image_source: raw.cover_image_source ?? null,
    cover_image_blurhash: raw.cover_image_blurhash ?? null,
  };
}
