/**
 * CV-4 갭워치 — 커버리지 결측을 «표가 들고 있게» 한다 (2026-09-02).
 *
 * 하루 한 번 7지표를 재서 `gap_watch_snapshots` 에 적고, 주 1회(월요일) 다이제스트를
 * `admin_alerts` 로 보낸다. 임계를 넘으면 요일과 무관하게 그날 바로 보낸다.
 *
 * ⛔ 알림 생산자를 새로 만들지 않는다 — `admin_alerts` 하나로 나간다.
 * ⚠️ 지표 정의·임계·문구는 `@/lib/gap/metrics` 에 있다. 여기는 «재는 일» 만 한다.
 *    두 곳에 규칙을 두면 판정이 갈린다(오늘 하루의 교훈 그대로다).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { fetchAll } from '@/lib/db/fetchBatched';
import {
  GAP_METRICS, digestSeverity, formatDigest, severityOf,
  type GapReading,
} from '@/lib/gap/metrics';
// ⚠️ 라우트 모듈은 헬퍼를 export 하지 못한다(생성 타입이 거부). 판정 본문은 lib 에 산다.
import { countSimilarPairs } from '@/lib/gap/similar-pairs';
import { healAppliedAliases } from '@/lib/cvn/apply';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const def = (key: string) => {
  const d = GAP_METRICS.find((m) => m.key === key);
  if (!d) throw new Error(`갭 지표 정의 없음: ${key}`);
  return d;
};

async function handler(req: NextRequest) {
  const admin = getSupabaseAdmin() as any;
  const sp = req.nextUrl.searchParams;
  const dry = sp.get('dry') === '1';
  const forceDigest = sp.get('digest') === '1';

  const count = async (table: string, build: (q: any) => any): Promise<number> => {
    const { count: n } = await build(admin.from(table).select('id', { count: 'exact', head: true }));
    return n ?? 0;
  };

  const cutoff180 = new Date(Date.now() - 180 * 86400000).toISOString();

  const [preAnn, permitsUnmatched, conflicting, queued] = await Promise.all([
    count('apt_sites', (q: any) => q.eq('is_active', true).eq('lifecycle_stage', 'pre_announcement')),
    count('apt_permits', (q: any) => q.is('matched_site_id', null)),
    count('apt_sites', (q: any) => q.eq('is_active', true).eq('confidence', 'conflicting')),
    count('presale_candidates', (q: any) => q.eq('resolution', 'queued')),
  ]);

  const redevStale = await count('apt_sites', (q: any) =>
    q.eq('is_active', true).eq('site_type', 'redevelopment').lt('stage_updated_at', cutoff180));
  const redevNoTs = await count('apt_sites', (q: any) =>
    q.eq('is_active', true).eq('site_type', 'redevelopment').is('stage_updated_at', null));

  // ⚠️ 「미매칭 인허가」는 한 숫자로는 두 상태를 못 가른다 — «아직 안 봤다(pending)» 와
  //    «봤는데 붙을 현장이 없다(unmatched)» 는 할 일이 완전히 다르다(PV-3b / 신규 시드).
  const permitStatus: Record<string, number> = {};
  for (const st of ['pending', 'review', 'no_target', 'rejected']) {
    permitStatus[st] = await count('apt_permits', (q: any) => q.eq('match_status', st));
  }

  const { data: healthRows } = await admin.from('presale_source_health')
    .select('source_key, zero_streak, last_ok_at').gte('zero_streak', 2);

  // ⚠️ `.limit(20000)` 은 «거짓말» 이다 — PostgREST `db-max-rows` 가 1,000 이라 첫 장만 온다.
  //    실측으로 잡혔다: 이 지표의 첫 라이브 값이 8 이었는데 DB 로 직접 세면 129 였다.
  //    한 장만 받고 「유사쌍이 적다」고 적을 뻔했다 — 지표가 스스로를 낮추는 전형이다.
  const siteRows = await fetchAll(admin, 'apt_sites', 'id, name, region, sigungu, dong',
    (q: any) => q.eq('is_active', true).not('dong', 'is', null));
  const similar = countSimilarPairs(siteRows as any);

  // 직전 관측 — 델타의 기준이다. 없으면 «첫 관측» 으로 적는다.
  const { data: prevRows } = await admin.from('gap_watch_snapshots')
    .select('metric, value, taken_at').order('taken_at', { ascending: false }).limit(GAP_METRICS.length * 3);
  const prev = new Map<string, number>();
  let prevAt: string | null = null;
  for (const r of (prevRows ?? []) as Array<{ metric: string; value: number; taken_at: string }>) {
    if (!prev.has(r.metric)) { prev.set(r.metric, r.value); prevAt = prevAt ?? r.taken_at; }
  }

  const readings: GapReading[] = [
    { def: def('pre_announcement'), value: preAnn, prev: prev.get('pre_announcement') ?? null },
    {
      def: def('permits_unmatched'), value: permitsUnmatched,
      prev: prev.get('permits_unmatched') ?? null, detail: { by_status: permitStatus },
    },
    { def: def('confidence_conflicting'), value: conflicting, prev: prev.get('confidence_conflicting') ?? null },
    {
      def: def('same_dong_similar_pairs'), value: similar.pairs,
      prev: prev.get('same_dong_similar_pairs') ?? null, detail: { samples: similar.samples },
    },
    {
      def: def('redev_stale_180d'), value: redevStale,
      prev: prev.get('redev_stale_180d') ?? null, detail: { no_stage_ts: redevNoTs },
    },
    { def: def('candidates_queued'), value: queued, prev: prev.get('candidates_queued') ?? null },
    {
      def: def('source_zero_streak'), value: (healthRows ?? []).length,
      prev: prev.get('source_zero_streak') ?? null, detail: { sources: healthRows ?? [] },
    },
  ];

  // ── CV-N 2지표 + 야간 대사 (2026-09-08) ─────────────────────────────────
  // ⚠️ 대사가 «먼저» 다. 자가치유가 되살린 뒤의 상태를 재야 지표가 오늘의 진실이 된다.
  //    원장은 applied 인데 별칭이 없는 행을 되살린다 — 어떤 미래의 쓰기가 지워도
  //    다음 밤 원장이 되살린다는 것이 v1.2-B 의 약속이다.
  const heal = dry
    ? { checked: 0, missing: 0, rehealed: 0, samples: [] as Array<{ siteId: string; alias: string }> }
    : await healAppliedAliases(admin, `gap-watch-${new Date().toISOString().slice(0, 10)}`);

  // 선점률 — 「첫 보도 시점에 이미 그 이름을 갖고 있었는가」의 대리 지표다.
  // 적용기가 별칭을 «새로 넣지 않았다» = 이미 갖고 있었다는 뜻이므로, 최근 후보 20건 중
  // alias_add 기록이 없는 비율을 센다.
  // ⚠️ 분모는 «보도로 들어온» 후보뿐이다. 브랜드관(brand_registry:)과 수동 주입(manual:)을
  //    섞으면 지표가 자기 정의를 벗어난다 — 2026-09-08 실측으로 잡혔다: 채팅 주입 8건을
  //    원장에 사후 등재하자 선점률이 0% 로 찍혔다. 그 8건은 «보도로 온 것이 아니라»
  //    이미 갖고 있던 것이어서, 분모에 들어간 것 자체가 틀렸다.
  const { data: recentCand } = await admin
    .from('site_name_candidates')
    .select('id, site_id')
    .not('site_id', 'is', null)
    .like('source', 'news:%')
    .order('first_seen_at', { ascending: false })
    .limit(20);
  const candRows = (recentCand ?? []) as Array<{ id: number; site_id: string }>;
  let preempt = 0;
  if (candRows.length) {
    const { data: addRows } = await admin
      .from('site_name_applies')
      .select('candidate_id')
      .eq('op', 'alias_add')
      .in('candidate_id', candRows.map((c) => c.id));
    const added = new Set(((addRows ?? []) as Array<{ candidate_id: number }>).map((r) => r.candidate_id));
    preempt = Math.round((candRows.filter((c) => !added.has(c.id)).length / candRows.length) * 100);
  }

  // 브랜드 별칭 커버리지 — 시공사가 있는 정비 현장 중 브랜드 이름을 가진 비율.
  const { data: brandRows } = await admin.from('brand_tokens').select('brand').eq('is_active', true);
  const brandList = ((brandRows ?? []) as Array<{ brand: string }>).map((b) => b.brand.replace(/\s/g, ''));
  const redevRows = await fetchAll(admin, 'apt_sites', 'id, name, display_name, builder, name_variants',
    (q: any) => q.eq('is_active', true));
  const redev = (redevRows as any[]).filter(
    (r) => /(재개발|재건축|촉진|정비사업|지구단위)/.test(r.name ?? '')
      && r.builder && String(r.builder).trim(),
  );
  const withBrand = redev.filter((r) => {
    const hay = [r.display_name ?? '', r.name ?? '', ...(Array.isArray(r.name_variants) ? r.name_variants : [])]
      .join(' ').replace(/\s/g, '');
    return brandList.some((b) => hay.includes(b));
  });
  const coverage = redev.length ? Math.round((withBrand.length / redev.length) * 100) : 0;

  readings.push(
    { def: def('cvn_name_preempt'), value: preempt, prev: prev.get('cvn_name_preempt') ?? null,
      detail: { sampled: candRows.length } },
    { def: def('cvn_brand_alias_coverage'), value: coverage, prev: prev.get('cvn_brand_alias_coverage') ?? null,
      detail: { denom: redev.length, with_brand: withBrand.length } },
    { def: def('cvn_alias_heal'), value: heal.rehealed, prev: prev.get('cvn_alias_heal') ?? null,
      detail: { checked: heal.checked, missing: heal.missing, samples: heal.samples } },
  );

  const body = formatDigest(readings, prevAt);
  const sev = digestSeverity(readings);

  // 월요일(KST) 이거나 임계를 넘었으면 보낸다. ⚠️ 조용한 주에도 «주 1회는» 보낸다 —
  // 침묵이 「문제 없음」인지 「죽었음」인지 구분되지 않는 것이 이 트랙이 고치려는 병이다.
  const kstDay = new Date(Date.now() + 9 * 3600000).getUTCDay();
  const send = forceDigest || sev !== 'ok' || kstDay === 1;

  if (!dry) {
    await admin.from('gap_watch_snapshots').insert(readings.map((r) => ({
      metric: r.def.key, value: r.value, severity: severityOf(r.def, r.value, r.prev),
      detail: r.detail ?? null,
    })));
    if (send) {
      await admin.from('admin_alerts').insert({
        type: 'gap_watch',
        severity: sev === 'critical' ? 'critical' : sev === 'warning' ? 'warning' : 'info',
        title: sev === 'ok' ? '갭워치 주간 — 손볼 것 없음' : `갭워치 — 손볼 것 ${readings.filter((r) => severityOf(r.def, r.value, r.prev) !== 'ok').length}건`,
        message: body,
        metadata: { readings: readings.map((r) => ({ k: r.def.key, v: r.value, p: r.prev ?? null })) },
      });
    }
  }

  return {
    processed: readings.length,
    metadata: {
      dry, sent: send && !dry, severity: sev, prev_at: prevAt,
      values: Object.fromEntries(readings.map((r) => [r.def.key, r.value])),
      digest: body,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('gap-watch', () => handler(req));
  return NextResponse.json(result);
}
