// r4-P5 — lifecycle 축(/apt/stage/[stage]/[region]) 공용 로직.
//
// 기존 /apt/region/[region]/[sigungu]/[category] 는 동결한다. 그 축은 site_type(데이터 출처)이고
// 이 축은 lifecycle_stage(실제 단계)다. 둘은 정렬돼 있지 않다 —
// site_type='subscription' 2,960건 중 실제 청약 단계는 31건이고 2,172건이 기축이다.
// 같은 URL 슬롯에 두 분류 축을 섞을 수 없어서 경로를 나눈다.
//
// lifecycle_stage -> segment 매핑의 원본은 DB 함수 public.apt_stage_segment(text) 다.
// 아래 LIFECYCLES 는 그 함수가 CHECK 허용 14값에 대해 돌려주는 값을 그대로 옮긴 것이다.
// 함수를 고치면 여기도 함께 고친다.

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isIndexable } from '@/lib/apt/indexable';

export const STAGE_KEYS = ['planned', 'offering', 'new', 'existing', 'redev'] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

/** 17개 시도. 시군구는 만들지 않는다. */
export const STAGE_REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

export interface StageDef {
  label: string;
  eyebrow: string;
  /** 페이지 설명문. {region} 치환. */
  describe: (region: string, n: number) => string;
  /**
   * 'sites'  = apt_sites 를 lifecycle_stage 로 거른다
   * 'subs'   = apt_subscriptions 를 쓴다. apt_sites 의 청약 단계는 전국 31건뿐이라 쓰면 안 된다.
   */
  source: 'sites' | 'subs';
  lifecycles: string[];
}

export const STAGES: Record<StageKey, StageDef> = {
  planned: {
    label: '계획·예정',
    eyebrow: 'PLANNED — 아직 분양 전',
    describe: (r, n) => `${r}에서 분양을 준비 중인 사업장 ${n.toLocaleString()}곳입니다. 사전 공고와 부지 계획 단계라 일정이 바뀔 수 있습니다.`,
    source: 'sites',
    lifecycles: ['pre_announcement', 'site_planning'],
  },
  offering: {
    label: '분양중',
    eyebrow: 'OFFERING — 청약 진행·마감',
    describe: (r, n) => `${r}의 청약 단지 ${n.toLocaleString()}곳입니다. 접수 일정·경쟁률·공급 세대수를 정리했습니다.`,
    source: 'subs',
    lifecycles: ['award_announced', 'contract_signing', 'model_house_open', 'special_supply', 'subscription_open'],
  },
  new: {
    label: '신축·입주',
    eyebrow: 'NEW — 입주 예정·미분양',
    describe: (r, n) => `${r}의 입주 예정·신축 단지 ${n.toLocaleString()}곳입니다. 입주장 시세와 미분양 물량을 함께 봅니다.`,
    source: 'sites',
    lifecycles: ['move_in_ready', 'move_in_started', 'unsold_active'],
  },
  existing: {
    label: '기축',
    eyebrow: 'EXISTING — 입주 완료 단지',
    describe: (r, n) => `${r}의 입주 완료 단지 ${n.toLocaleString()}곳입니다. 실거래가와 단지 정보를 정리했습니다.`,
    source: 'sites',
    lifecycles: ['active_trade', 'landmark_active', 'post_move_in'],
  },
  redev: {
    label: '재개발·재건축',
    eyebrow: 'REDEV — 정비사업 진행',
    describe: (r, n) => `${r}의 정비사업 단지 ${n.toLocaleString()}곳입니다.`,
    source: 'sites',
    lifecycles: ['redevelopment_active'],
  },
};

export function isStageKey(v: string): v is StageKey {
  return (STAGE_KEYS as readonly string[]).includes(v);
}

export function isStageRegion(v: string): boolean {
  return (STAGE_REGIONS as readonly string[]).includes(v);
}

export interface StageRow {
  slug: string;
  name: string;
  region: string;
  sigungu: string | null;
  caption: string;
  summary: string;
}

const fmtHouseholds = (n?: number | null) => (n ? `${Number(n).toLocaleString()}세대` : '');

/** 목록 조회. limit 은 화면용 상한이고, 색인 판정은 반환 길이로 한다. */
export async function fetchStageRows(stage: StageKey, region: string, limit = 60): Promise<StageRow[]> {
  const sb = getSupabaseAdmin();
  const def = STAGES[stage];

  if (def.source === 'subs') {
    const { data } = await (sb as any)
      .from('apt_subscriptions')
      .select('slug, house_nm, region_nm, supply_addr, tot_supply_hshld_co, rcept_bgnde, mvn_prearnge_ym, constructor_nm')
      .eq('region_nm', region)
      .not('slug', 'is', null)
      .order('rcept_bgnde', { ascending: false, nullsFirst: false })
      .limit(limit);
    return ((data ?? []) as any[]).map((r) => ({
      slug: r.slug,
      name: r.house_nm ?? '',
      region: r.region_nm ?? region,
      sigungu: null,
      caption: [r.constructor_nm, fmtHouseholds(r.tot_supply_hshld_co)].filter(Boolean).join(' · '),
      summary: [r.supply_addr, r.mvn_prearnge_ym ? `입주 예정 ${r.mvn_prearnge_ym}` : ''].filter(Boolean).join(' · '),
    }));
  }

  const { data } = await (sb as any)
    .from('apt_sites')
    .select('slug, name, region, sigungu, dong, builder, total_units, move_in_date, popularity_score')
    .eq('region', region)
    .eq('is_active', true)
    .in('lifecycle_stage', def.lifecycles)
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  return ((data ?? []) as any[]).map((r) => ({
    slug: r.slug,
    name: r.name ?? '',
    region: r.region ?? region,
    sigungu: r.sigungu ?? null,
    caption: [r.builder, fmtHouseholds(r.total_units)].filter(Boolean).join(' · '),
    summary: [[r.sigungu, r.dong].filter(Boolean).join(' '), r.move_in_date ? `입주 ${r.move_in_date}` : '']
      .filter(Boolean)
      .join(' · '),
  }));
}

/**
 * 색인 가능한 (stage, region) 조합. generateStaticParams 와 사이트맵이 같은 이 함수를 쓴다.
 * 네 곳(사이트맵·메타·generateStaticParams·본문)이 갈리면 클로킹이 된다.
 */
export async function fetchIndexableStagePairs(): Promise<Array<{ stage: StageKey; region: string; count: number }>> {
  const sb = getSupabaseAdmin();
  const out: Array<{ stage: StageKey; region: string; count: number }> = [];

  try {
    const [sitesRes, subsRes] = await Promise.all([
      (sb as any)
        .from('apt_sites')
        .select('region, lifecycle_stage')
        .eq('is_active', true)
        .not('lifecycle_stage', 'is', null)
        .limit(20000),
      (sb as any)
        .from('apt_subscriptions')
        .select('region_nm')
        .not('slug', 'is', null)
        .limit(20000),
    ]);

    const stageOf = new Map<string, StageKey>();
    for (const k of STAGE_KEYS) for (const ls of STAGES[k].lifecycles) stageOf.set(ls, k);

    const counts = new Map<string, number>();
    for (const r of ((sitesRes as any)?.data ?? []) as any[]) {
      const k = stageOf.get(r.lifecycle_stage);
      // offering 은 apt_sites 를 쓰지 않는다 (전국 31건뿐)
      if (!k || k === 'offering' || !isStageRegion(r.region)) continue;
      const key = `${k}|${r.region}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const r of ((subsRes as any)?.data ?? []) as any[]) {
      if (!isStageRegion(r.region_nm)) continue;
      const key = `offering|${r.region_nm}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    for (const [key, count] of counts) {
      if (!isIndexable(count)) continue;
      const [stage, region] = key.split('|');
      out.push({ stage: stage as StageKey, region, count });
    }
  } catch (err) {
    console.error('[apt/stage pairs]', err);
    return [];
  }

  return out.sort((a, b) => b.count - a.count);
}
