/**
 * /apt-v2/redevelopment
 */

import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  PageHeader,
  CategoryTabs,
  RedevelopmentTab,
} from '@/components/apt-tabs';
import { triggerMissingCoverResolution } from '@/lib/apt/resolveCoverImage';
import { dDayFrom } from '@/components/apt-tabs/utils';
import type {
  Region,
  Kpi,
  RedevelopmentItem,
  AptSiteCover,
} from '@/components/apt-tabs/types';

export const revalidate = 600;

export const metadata: Metadata = {
  title: '재개발 진행 현황 - 카더라',
  description: '7단계별 진행 상황과 다음 마일스톤을 한눈에.',
};

const DEFAULT_REGION_CODE = '1168011000';

const PHASE_LABEL: Record<string, string> = {
  planning: '정비계획',
  union: '조합설립',
  project: '사업시행',
  management: '관리처분',
  demolition: '이주·철거',
  construction: '착공',
  completion: '완공',
};

type SearchParams = { region?: string };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const regionCode = params.region ?? DEFAULT_REGION_CODE;

  const [region, kpis, items] = await Promise.all([
    fetchRegion(regionCode),
    fetchRedevelopmentKpis(regionCode),
    fetchRedevelopmentItems(regionCode),
  ]);

  triggerMissingCoverResolution(items);

  return (
    <main className="aptr-root">
      <PageHeader region={region} kpis={kpis} />
      <CategoryTabs active="redevelopment" basePath="/apt-v2" />
      <RedevelopmentTab items={items} />
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
    console.error('[apt-v2/redev/region]', err);
  }
  return { code: regionCode, name: '압구정동', parentName: '서울 강남구' };
}

async function fetchRedevelopmentKpis(regionCode: string): Promise<Kpi[]> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('apt_redevelopments')
      .select('progress_pct, status')
      .eq('region_code', regionCode)
      .not('status', 'in', '(completed,cancelled)');

    const list = (data ?? []) as Array<{ progress_pct: number | null }>;
    const count = list.length;
    const avgProgress =
      list.length > 0
        ? Math.round(
            list.reduce((s, r) => s + (r.progress_pct ?? 0), 0) / list.length
          )
        : 0;

    return [
      { label: '진행 단지', value: `${count}` },
      { label: '평균 진행률', value: `${avgProgress}%` },
    ];
  } catch (err) {
    console.error('[apt-v2/redev/kpis]', err);
    return [
      { label: '진행 단지', value: '-' },
      { label: '평균 진행률', value: '-' },
    ];
  }
}

async function fetchRedevelopmentItems(regionCode: string): Promise<RedevelopmentItem[]> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('apt_redevelopments')
      .select(
        `
        id, phase_id, progress_pct, members,
        next_milestone_label, next_milestone_date,
        site:apt_sites (id, name, cover_image_url, cover_image_kind, cover_image_source, cover_image_blurhash)
      `
      )
      .eq('region_code', regionCode)
      .not('status', 'in', '(completed,cancelled)')
      .order('progress_pct', { ascending: false })
      .limit(10);

    if (!data) return [];

    return (data as any[]).map((row) => ({
      id: String(row.id),
      site: normalizeSite(row.site),
      phaseId: row.phase_id ?? 'planning',
      phaseLabel: PHASE_LABEL[row.phase_id] ?? '정비계획',
      progressPct: row.progress_pct ?? 0,
      nextMilestoneLabel: row.next_milestone_label ?? undefined,
      nextMilestoneDDay: row.next_milestone_date
        ? dDayFrom(row.next_milestone_date)
        : undefined,
      members: row.members ?? undefined,
      href: `/apt/redevelopment/${row.id}`,
    }));
  } catch (err) {
    console.error('[apt-v2/redev/items]', err);
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
