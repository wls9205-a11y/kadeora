// FW(2026~2030 미래 진행 부동산 재편) 생산자 — 현장 기점 적재(세션 A 정본 「지시서_FW_20260919」 골자, docs/bn/BN_CC_reply_20260918.md 15차).
//
// 뉴스 경로는 부동산 글을 만들지 못한다(전환 3% · no_entity 95%) → 현장에서 글감을 만든다.
// 저수지 4축: 청약(공고~발표) · 분양예정(expected_sale_sort 2026~2030) · 입주(move_in_date 2026~2030, 부울경) · 정비(부울경 조합~착공).
// ⛔ 옛 issue-preempt(무작위 미커버 선정 · summary 에 세대수·시공사 날것)를 재사용하지 않는다 — 전면 신작.
// ⛔ 스위치 fw.producer_enabled 가 정확히 true 일 때만 적재한다(off 시작). 발행은 fw 판독 모드(review-hold.ts)로 hold 초안.
// 글감 규격은 BN 과 같다: apt_site_id(hub 고정) · template site_compact · 운영 표기 0 · source_urls 비움.

export type FwAxis = 'subscription' | 'presale' | 'move_in' | 'redev';

const BUGYEONG = ['부산', '울산', '경남'];
const REDEV_STAGES = ['union_established', 'constructor_selected', 'plan_approved', 'mgmt_approved', 'construction'];
const SUB_STAGES = ['pre_announcement', 'subscription_open', 'award_pending'];

export interface FwSite { id: string; slug: string; name: string; display_name: string | null; region: string | null; sigungu: string | null }

/** 스위치 — 정확히 true 만 켜짐. */
export async function fwSwitch(sb: any, key: 'producer_enabled' | 'hub_publish_enabled'): Promise<boolean> {
  const { data } = await sb.from('app_config').select('value').eq('namespace', 'fw').eq('key', key).maybeSingle();
  return data?.value === true;
}

const COLS = 'id, slug, name, display_name, region, sigungu';

/**
 * 일 캡 — issue-draft 60/KST일 버킷은 뉴스·BN 과 공유 자원이다(9/19 한도 우회 사고). FW 적재는 KST 하루 캡 안에서만.
 * 값은 app_config fw.daily_cap(기본 30, 세션 A 판정 2026-09-19). 상향은 전환 스위치 on 창에서 설정값 1회.
 */
export const FW_DAILY_CAP_DEFAULT = 30;
export function kstDayStartIso(now = new Date()): string {
  const k = new Date(now.getTime() + 9 * 3600_000);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3600_000).toISOString();
}
export async function capLeft(sb: any, now = new Date()): Promise<number> {
  const { data } = await sb.from('app_config').select('value').eq('namespace', 'fw').eq('key', 'daily_cap').maybeSingle();
  const cap = Number.isFinite(Number(data?.value)) && data?.value !== null ? Number(data.value) : FW_DAILY_CAP_DEFAULT;
  if (cap <= 0) return 0;
  // 캡이 작아 행을 cap 개까지만 받아 센다(count:exact 핫패스 금지 — no-exact-count-hotpath).
  const { data: rows } = await sb.from('issue_alerts').select('id')
    .eq('source_type', 'fw_hub').gte('created_at', kstDayStartIso(now)).limit(cap);
  return Math.max(0, cap - ((rows ?? []) as unknown[]).length);
}

/** 축별 후보. 우선순위는 축 안에서 결정적(가까운 시기 먼저). */
export async function candidates(sb: any, axis: FwAxis, limit: number): Promise<FwSite[]> {
  let q = sb.from('apt_sites').select(COLS).eq('is_active', true);
  if (axis === 'subscription') q = q.in('lifecycle_stage', SUB_STAGES).not('source_ids->>subscription_id', 'is', null).order('updated_at', { ascending: false });
  if (axis === 'presale') q = q.gte('expected_sale_sort', '2026-01-01').lte('expected_sale_sort', '2030-12-31').order('expected_sale_sort', { ascending: true });
  if (axis === 'move_in') q = q.in('region', BUGYEONG).gte('move_in_date', '202601').lte('move_in_date', '203012').order('move_in_date', { ascending: true });
  if (axis === 'redev') q = q.in('region', BUGYEONG).eq('site_type', 'redevelopment').in('lifecycle_stage', REDEV_STAGES).order('stage_updated_at', { ascending: false, nullsFirst: false });
  const { data } = await q.limit(Math.max(limit * 20, 40));
  return (data ?? []) as FwSite[];
}

/** 이미 글감이 있거나 hub 발행글이 있는 현장은 건너뛴다(같은 현장 중복 판정은 issue-draft 가 한 번 더 본다). */
async function uncovered(sb: any, sites: FwSite[]): Promise<FwSite[]> {
  if (sites.length === 0) return [];
  const ids = sites.map((s) => s.id);
  const slugs = sites.map((s) => s.slug);
  const [{ data: al }, { data: pub }] = await Promise.all([
    sb.from('issue_alerts').select('apt_site_id').in('apt_site_id', ids).in('source_type', ['fw_hub', 'bn_hub', 'bp70_hub']),
    sb.from('blog_posts').select('hub_apt_slug').in('hub_apt_slug', slugs).eq('is_published', true),
  ]);
  const hasAlert = new Set(((al ?? []) as any[]).map((r) => r.apt_site_id));
  const hasPub = new Set(((pub ?? []) as any[]).map((r) => r.hub_apt_slug));
  return sites.filter((s) => !hasAlert.has(s.id) && !hasPub.has(s.slug));
}

const TITLE_TAIL: Record<FwAxis, string> = {
  subscription: '청약 일정·조건 정리',
  presale: '분양 일정 정리',
  move_in: '입주 예정 정리',
  redev: '사업 단계·일정 정리',
};

/** 표기 이름 — display 규격 「{예정명} — {구역명}」의 앞쪽, 없으면 name. */
const shownName = (s: FwSite) => (String(s.display_name ?? '').split(' — ')[0].trim() || s.name);

/** 글감 적재. 운영 키는 프롬프트 제외 목록(batch 등)에 있다. */
export async function enqueue(sb: any, sites: FwSite[], axis: FwAxis, via: 'rotation' | 'stage_hook'): Promise<string[]> {
  const rows = sites.map((s) => {
    const nm = shownName(s);
    return {
      title: `${nm} ${TITLE_TAIL[axis]}`,
      summary: `${nm} — ${[s.region, s.sigungu].filter(Boolean).join(' ')} ${TITLE_TAIL[axis]}`,
      category: 'apt', sub_category: 'fw_hub', issue_type: axis === 'redev' ? 'redevelopment' : 'pre_announcement',
      source_type: 'fw_hub', source_urls: [], detected_keywords: [nm, `${nm} ${axis === 'move_in' ? '입주' : '분양'}`],
      apt_site_id: s.id, region_sido: s.region, region_sigungu: s.sigungu, base_score: 45, final_score: 45,
      raw_data: { batch: `FW-${via}`, slug: s.slug, axis, template: 'site_compact',
        title_spec: `「${nm} ${TITLE_TAIL[axis]}」 형식, 25~40자. 연도·월 숫자는 현장 블록에 있는 값만. 하이픈 절단 금지` },
    };
  });
  if (rows.length === 0) return [];
  const { data, error } = await sb.from('issue_alerts').insert(rows).select('raw_data');
  if (error) throw new Error(`fw enqueue: ${error.message}`);
  return ((data ?? []) as any[]).map((r) => r.raw_data?.slug);
}

/** 회전 — 축을 돌며 합계 perRun 건. */
export async function runRotation(sb: any, perRun = 4): Promise<Record<FwAxis, string[]>> {
  const out: Record<FwAxis, string[]> = { subscription: [], presale: [], move_in: [], redev: [] };
  const axes: FwAxis[] = ['subscription', 'presale', 'move_in', 'redev'];
  let left = Math.min(perRun, await capLeft(sb));
  for (const axis of axes) {
    if (left <= 0) break;
    const share = Math.max(1, Math.ceil(perRun / axes.length));
    const picks = (await uncovered(sb, await candidates(sb, axis, share))).slice(0, Math.min(share, left));
    out[axis] = await enqueue(sb, picks, axis, 'rotation');
    left -= out[axis].length;
  }
  return out;
}

/**
 * sync-apt-sites 훅(가속기) — 이번 회전에서 «실제로 움직인» 정비 현장(stage_change, backfill 제외)을 글감으로.
 * ⚠️ backfill 필터 필수: 9/14 292건은 1회 백필(`backfill:redev:*`)이었다.
 */
export async function stageHook(sb: any, sinceIso: string): Promise<string[]> {
  const { data: ev } = await sb.from('apt_site_events').select('site_id, source')
    .eq('event_type', 'stage_change').gte('created_at', sinceIso).not('source', 'like', 'backfill:%');
  const ids = [...new Set(((ev ?? []) as any[]).map((e) => e.site_id).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data: sites } = await sb.from('apt_sites').select(COLS).in('id', ids).eq('is_active', true)
    .in('region', BUGYEONG).eq('site_type', 'redevelopment').in('lifecycle_stage', REDEV_STAGES);
  const picks = await uncovered(sb, (sites ?? []) as FwSite[]);
  return enqueue(sb, picks.slice(0, Math.min(6, await capLeft(sb))), 'redev', 'stage_hook');
}
