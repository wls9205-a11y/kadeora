/**
 * CV-N 적용기 — 후보를 실제 현장에 «쓰는» 층 (2026-09-08).
 *
 * ── 이 파일의 존재 이유는 «순서» 다 ─────────────────────────────────────────
 * DB 실측: `trg_apt_sites_auto_variants` 는
 *     BEFORE INSERT OR UPDATE OF name, sigungu, dong, builder
 * 이고 본문이 `COALESCE(jsonb_array_length(NEW.name_variants), 0) < 3` 이면
 * `generate_apt_name_variants_jsonb` 로 **통째 교체**한다.
 *
 * 그래서 두 가지가 참이다:
 *   ① 별칭«만» 쓰는 UPDATE 는 트리거를 아예 깨우지 않는다 — 안전하다.
 *   ② builder 를 쓰는 UPDATE 는 깨운다. 그 시점 별칭이 3 미만이면 방금 넣은 별칭이 사라진다.
 * → 규칙: **트리거 컬럼(builder)을 먼저 쓰고, 별칭을 마지막에 병합한다.**
 *
 * 실측 2026-09-08: 활성 6,285 중 별칭 3 미만 467건(7.4%)이 이 사정권이다.
 * 순서만으로 부족할 때를 위해 CV-4 야간 대사가 「applied ↔ 별칭 실재」를 대조하고
 * 없으면 재주입한다(자가치유). 어떤 미래의 쓰기가 지워도 다음 밤 원장이 되살린다.
 */

import {
  checkAliasUniqueness,
  composeDisplayName,
  decideTier,
  demoteDisplayName,
  matchSite,
  type NameCandidateInput,
  type Resolution,
  type SiteLite,
  type Tier,
} from './decide';

export interface ApplyOutcome {
  candidateId: number | null;
  siteId: string | null;
  tier: Tier | null;
  resolution: Resolution;
  /** 실제로 DB 를 바꿨는가. 섀도에서는 언제나 false 다. */
  wrote: boolean;
  reason: string;
  aliasAdded?: string;
  displaySet?: string;
}

export interface ApplyDeps {
  /** service_role 클라이언트. */
  admin: any;
  /** 이번 회전 식별자 — 대장과 롤백이 이걸로 묶인다. */
  runId: string;
  /** false 면 «섀도» — 원장에만 적고 현장은 건드리지 않는다. */
  autoApply: boolean;
}

/** app_config 의 CV-N 스위치를 읽는다. 없으면 «꺼진 것» 으로 본다 — 기본이 안전이다. */
export async function readSwitch(admin: any, key: string, fallback: boolean): Promise<boolean> {
  const { data } = await admin
    .from('app_config')
    .select('value')
    .eq('namespace', 'cvn')
    .eq('key', key)
    .maybeSingle();
  if (!data) return fallback;
  return data.value === true || data.value === 'true';
}

export async function setSwitch(admin: any, key: string, value: boolean): Promise<void> {
  await admin
    .from('app_config')
    .upsert(
      { namespace: 'cvn', key, value, updated_at: new Date().toISOString() },
      { onConflict: 'namespace,key' },
    );
}

/** 결정에 필요한 필드만 실은 현장 목록. 매칭·유일성이 «전 활성 레코드» 를 봐야 한다. */
export async function loadSites(admin: any): Promise<SiteLite[]> {
  const { fetchAll } = await import('@/lib/db/fetchBatched');
  const rows = await fetchAll(
    admin,
    'apt_sites',
    'id, name, display_name, sigungu, region, builder, total_units, name_variants, is_active',
    (q: any) => q.eq('is_active', true),
  );
  return (rows as any[]).map((r) => ({
    ...r,
    name_variants: Array.isArray(r.name_variants) ? r.name_variants : [],
  })) as SiteLite[];
}

async function ledger(
  deps: ApplyDeps,
  candidateId: number | null,
  siteId: string,
  op: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  await deps.admin.from('site_name_applies').insert({
    candidate_id: candidateId,
    site_id: siteId,
    op,
    before_value: before ?? null,
    after_value: after ?? null,
    run_id: deps.runId,
  });
}

/**
 * 후보 한 건을 큐에 남기고, 티어가 허락하면 현장에 쓴다.
 *
 * ⛔ 어떤 경우에도 레코드를 «만들지» 않고 «지우지» 않는다.
 * ⛔ 미매칭을 폐기하지 않는다 — resolution='pending' 으로 큐에 남는다.
 */
export async function applyCandidate(
  input: NameCandidateInput,
  sites: SiteLite[],
  deps: ApplyDeps,
): Promise<ApplyOutcome> {
  const matched = matchSite(input, sites);
  const decision = decideTier(input, matched);
  const site = matched.siteId ? sites.find((s) => s.id === matched.siteId) ?? null : null;

  let resolution: Resolution = decision.resolution;
  let reason = decision.reason;
  let willWrite = decision.apply && !!site;

  // 유일성 — 주입 «전» 에 본다. 충돌하면 주입이 아니라 병합 큐다.
  if (willWrite && site && input.eventType !== 'cancel' && input.eventType !== 'rename') {
    const uniq = checkAliasUniqueness(input.proposedName, site.id, sites);
    if (!uniq.ok) {
      willWrite = false;
      resolution = 'merge_queue';
      reason = `별칭 충돌 ${uniq.conflicts.length}건 — 주입 대신 병합 큐`;
    }
  }

  // 섀도: L2 가 아직 autoapply 를 켜지 않았다. 크론은 돌되 원장만 남고 적용 0.
  if (willWrite && !deps.autoApply) {
    willWrite = false;
    resolution = 'shadow';
    reason = `${reason} (섀도 — autoapply OFF)`;
  }

  const { data: cand, error: candErr } = await deps.admin
    .from('site_name_candidates')
    .upsert(
      {
        site_id: site?.id ?? null,
        proposed_name: input.proposedName,
        event_type: input.eventType,
        tier: decision.tier,
        source: input.source,
        source_url: input.sourceUrl ?? null,
        builder_raw: input.builderRaw ?? null,
        total_units: input.totalUnits ?? null,
        region: input.region ?? input.sigungu ?? null,
        confidence: null,
        resolution,
        note: reason,
        applied_at: willWrite ? new Date().toISOString() : null,
      },
      { onConflict: 'source_url,proposed_name', ignoreDuplicates: false },
    )
    .select('id')
    .maybeSingle();

  const candidateId = (cand?.id as number | undefined) ?? null;
  const out: ApplyOutcome = {
    candidateId,
    siteId: site?.id ?? null,
    tier: decision.tier,
    resolution,
    wrote: false,
    reason,
  };

  // ⛔ 큐 등재 실패를 «조용히» 넘기지 않는다.
  //    2026-09-08 첫 회전 실측: upsert 가 42P10 으로 떨어졌는데 error 를 읽지 않아
  //    「분류 1건 · 큐 0행」이 됐다 — 분류까지 마친 사냥감이 영속화 직전에 증발했다.
  //    「미매칭을 폐기하지 않는다」는 원칙이 코드가 아니라 «침묵» 때문에 깨진 자리다.
  // ⚠️ 그렇다고 던지지도 않는다. 한 건의 실패가 그날 회전 전체를 죽이면 더 나쁘다 —
  //    실패를 «들고» 돌아가서 크론이 metadata 로 보고하게 한다.
  if (candErr) {
    out.resolution = 'pending';
    out.reason = `큐 등재 실패(적용 보류): ${(candErr as any)?.message ?? String(candErr)}`.slice(0, 300);
    return out;
  }
  if (!willWrite || !site) return out;

  // ── T-역: 해지·개명. 삭제가 아니라 «강등» 이다. ──────────────────────────
  if (decision.tier === 'T-역') {
    const next = demoteDisplayName(site.name);
    await ledger(deps, candidateId, site.id, 'display_demote', site.display_name ?? null, next);
    await deps.admin.from('apt_sites').update({ display_name: next }).eq('id', site.id);

    // 별칭은 «남긴다». 사람들은 한동안 옛 이름으로 검색한다.
    const variants = site.name_variants ?? [];
    if (!variants.includes(input.proposedName)) {
      const merged = [...variants, input.proposedName];
      await ledger(deps, candidateId, site.id, 'alias_add', variants, merged);
      await deps.admin.from('apt_sites').update({ name_variants: merged }).eq('id', site.id);
      out.aliasAdded = input.proposedName;
    }
    out.wrote = true;
    out.displaySet = next;
    return out;
  }

  // ── ① 트리거 컬럼 먼저 (builder). 여기서 별칭이 날아갈 수 있으므로 «먼저» 다. ──
  const builderBlank = !site.builder || !site.builder.trim();
  if (builderBlank && input.builderRaw && input.builderRaw.trim()) {
    await ledger(deps, candidateId, site.id, 'builder_set', site.builder ?? null, input.builderRaw);
    await deps.admin.from('apt_sites').update({ builder: input.builderRaw }).eq('id', site.id);
  }
  if (input.totalUnits && input.totalUnits > 0 && !site.total_units) {
    await ledger(deps, candidateId, site.id, 'units_set', site.total_units ?? null, input.totalUnits);
    await deps.admin.from('apt_sites').update({ total_units: input.totalUnits }).eq('id', site.id);
  }

  // ── ② display_name (트리거 컬럼이 아니다) ─────────────────────────────────
  const nextDisplay = composeDisplayName(input.proposedName, site.name);
  if (nextDisplay && nextDisplay !== site.display_name) {
    await ledger(deps, candidateId, site.id, 'display_set', site.display_name ?? null, nextDisplay);
    await deps.admin.from('apt_sites').update({ display_name: nextDisplay }).eq('id', site.id);
    out.displaySet = nextDisplay;
  }

  // ── ③ 별칭 «마지막». 이 UPDATE 는 트리거를 깨우지 않는다. ─────────────────
  const variants = site.name_variants ?? [];
  if (!variants.includes(input.proposedName)) {
    const merged = [...variants, input.proposedName];
    await ledger(deps, candidateId, site.id, 'alias_add', variants, merged);
    await deps.admin.from('apt_sites').update({ name_variants: merged }).eq('id', site.id);
    out.aliasAdded = input.proposedName;
  }

  out.wrote = true;
  return out;
}

/* ────────────────────────────────────────────────── 자가치유 (v1.2-B) */

export interface HealReport {
  checked: number;
  missing: number;
  rehealed: number;
  samples: Array<{ siteId: string; alias: string }>;
}

/**
 * 「원장 resolution=applied ↔ 별칭 실재」 대사. 어긋나면 재주입한다.
 *
 * 순서 규칙만으로는 «미래의 어떤 쓰기» 를 막지 못한다 — builder 를 건드리는 다른 크론이
 * 별칭 3 미만인 순간에 지나가면 주입분이 사라진다. 그래서 밤마다 원장이 대조하고 되살린다.
 * 소실이 구조적으로 불가능해지는 지점이 여기다.
 */
export async function healAppliedAliases(admin: any, runId: string, limit = 500): Promise<HealReport> {
  const { data: applied } = await admin
    .from('site_name_candidates')
    .select('id, site_id, proposed_name, tier')
    .eq('resolution', 'applied')
    .not('site_id', 'is', null)
    .order('applied_at', { ascending: false })
    .limit(limit);

  const rows = (applied ?? []) as Array<{
    id: number; site_id: string; proposed_name: string; tier: string | null;
  }>;
  const report: HealReport = { checked: rows.length, missing: 0, rehealed: 0, samples: [] };
  if (!rows.length) return report;

  const ids = Array.from(new Set(rows.map((r) => r.site_id)));
  const { data: siteRows } = await admin
    .from('apt_sites')
    .select('id, name_variants')
    .in('id', ids);
  const byId = new Map<string, string[]>(
    ((siteRows ?? []) as any[]).map((s) => [s.id, Array.isArray(s.name_variants) ? s.name_variants : []]),
  );

  for (const r of rows) {
    const variants = byId.get(r.site_id);
    if (!variants) continue; // 현장이 사라졌다 — 여기서 되살릴 일이 아니다
    if (variants.includes(r.proposed_name)) continue;

    report.missing += 1;
    const merged = [...variants, r.proposed_name];
    await admin.from('site_name_applies').insert({
      candidate_id: r.id,
      site_id: r.site_id,
      op: 'heal_realias',
      before_value: variants,
      after_value: merged,
      run_id: runId,
    });
    await admin.from('apt_sites').update({ name_variants: merged }).eq('id', r.site_id);
    byId.set(r.site_id, merged);
    report.rehealed += 1;
    if (report.samples.length < 10) report.samples.push({ siteId: r.site_id, alias: r.proposed_name });
  }
  return report;
}
