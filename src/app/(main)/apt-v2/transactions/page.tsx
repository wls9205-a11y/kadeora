/**
 * /apt-v2/transactions
 */

import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  PageHeader,
  CategoryTabs,
  TransactionsTab,
} from '@/components/apt-tabs';
import { triggerMissingCoverResolution } from '@/lib/apt/resolveCoverImage';
import type {
  Region,
  Kpi,
  TransactionItem,
  PriceChartPoint,
  AptSiteCover,
} from '@/components/apt-tabs/types';

export const revalidate = 600;

export const metadata: Metadata = {
  title: '실거래 시세 추이 - 카더라',
  description: '평당가 시계열, 신고가 단지, 최근 거래를 한눈에.',
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

  const [region, kpis, recent, highPrice, chart] = await Promise.all([
    fetchRegion(regionCode),
    fetchTransactionKpis(regionCode),
    fetchRecentTransactions(regionCode),
    fetchHighPriceTransactions(regionCode),
    fetchPriceChart(regionCode),
  ]);

  triggerMissingCoverResolution([...recent, ...highPrice]);

  return (
    <main className="aptr-root">
      <PageHeader region={region} kpis={kpis} />
      <CategoryTabs active="transactions" basePath="/apt-v2" />
      <TransactionsTab
        recentTransactions={recent}
        highPriceItems={highPrice}
        priceChartData={chart}
      />
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
    console.error('[apt-v2/tx/region]', err);
  }
  return { code: regionCode, name: '압구정동', parentName: '서울 강남구' };
}

async function fetchTransactionKpis(regionCode: string): Promise<Kpi[]> {
  const sb = getSupabaseAdmin();
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: txData } = await (sb as any)
      .from('apt_transactions')
      .select('price, area_sqm, change_pct, is_record_high')
      .eq('region_code', regionCode)
      .gte('date', since.toISOString().slice(0, 10));

    const list = (txData ?? []) as Array<{
      price: number;
      area_sqm: number;
      change_pct: number | null;
      is_record_high: boolean | null;
    }>;

    const count = list.length;
    const recordHighCount = list.filter((t) => t.is_record_high).length;
    const avgPyeong =
      list.length > 0
        ? Math.round(
            list.reduce(
              (s, t) => s + (t.price / (t.area_sqm * 0.3025) || 0),
              0
            ) / list.length
          )
        : 0;
    const avgChange =
      list.length > 0
        ? list
            .filter((t) => typeof t.change_pct === 'number')
            .reduce((s, t) => s + (t.change_pct ?? 0), 0) /
          Math.max(1, list.filter((t) => typeof t.change_pct === 'number').length)
        : 0;

    return [
      {
        label: '평당',
        value: avgPyeong ? `${(avgPyeong / 1e8).toFixed(2)}억` : '-',
        delta: avgChange ? `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)}%` : undefined,
        deltaTone: avgChange >= 0 ? 'positive' : 'negative',
      },
      { label: '30일', value: `${count}` },
      {
        label: '신고가',
        value: `${recordHighCount}`,
        deltaTone: recordHighCount > 0 ? 'positive' : 'neutral',
      },
    ];
  } catch (err) {
    console.error('[apt-v2/tx/kpis]', err);
    return [
      { label: '평당', value: '-' },
      { label: '30일', value: '-' },
      { label: '신고가', value: '-' },
    ];
  }
}

async function fetchRecentTransactions(regionCode: string): Promise<TransactionItem[]> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('apt_transactions')
      .select(
        `
        id, date, area_sqm, floor, price, change_pct, is_record_high,
        site:apt_sites (id, name, cover_image_url, cover_image_kind, cover_image_source, cover_image_blurhash)
      `
      )
      .eq('region_code', regionCode)
      .order('date', { ascending: false })
      .limit(20);

    if (!data) return [];
    return (data as any[]).map((row) => ({
      id: String(row.id),
      site: normalizeSite(row.site),
      date: row.date,
      areaSqm: row.area_sqm ?? 0,
      floor: row.floor ?? undefined,
      price: row.price ?? 0,
      changePct: row.change_pct ?? undefined,
      isRecordHigh: !!row.is_record_high,
      href: `/apt/transactions/${row.id}`,
    }));
  } catch (err) {
    console.error('[apt-v2/tx/recent]', err);
    return [];
  }
}

async function fetchHighPriceTransactions(regionCode: string): Promise<TransactionItem[]> {
  const sb = getSupabaseAdmin();
  try {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const { data } = await (sb as any)
      .from('apt_transactions')
      .select(
        `
        id, date, area_sqm, floor, price, change_pct, is_record_high,
        site:apt_sites (id, name, cover_image_url, cover_image_kind, cover_image_source, cover_image_blurhash)
      `
      )
      .eq('region_code', regionCode)
      .eq('is_record_high', true)
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .limit(8);

    if (!data) return [];
    return (data as any[]).map((row) => ({
      id: String(row.id),
      site: normalizeSite(row.site),
      date: row.date,
      areaSqm: row.area_sqm ?? 0,
      floor: row.floor ?? undefined,
      price: row.price ?? 0,
      changePct: row.change_pct ?? undefined,
      isRecordHigh: true,
      href: `/apt/transactions/${row.id}`,
    }));
  } catch (err) {
    console.error('[apt-v2/tx/high]', err);
    return [];
  }
}

async function fetchPriceChart(regionCode: string): Promise<PriceChartPoint[]> {
  const sb = getSupabaseAdmin();
  try {
    const since = new Date();
    since.setDate(since.getDate() - 365);

    const { data } = await (sb as any)
      .from('apt_price_history')
      .select('date, price_per_pyeong')
      .eq('region_code', regionCode)
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: true });

    if (!data) return [];
    return (data as any[]).map((row) => ({
      date: row.date,
      pricePerPyeong: row.price_per_pyeong ?? 0,
    }));
  } catch (err) {
    console.error('[apt-v2/tx/chart]', err);
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
