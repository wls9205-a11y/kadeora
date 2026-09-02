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

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bare = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '');

/**
 * 같은 법정동 안의 «유사쌍» 수. 중복 페이지 후보다.
 * ⚠️ 부분 문자열 포함으로만 본다. 느슨한 유사도(편집거리)를 쓰면
 *    「1차 ↔ 2차」처럼 «다른 단지» 가 대량으로 걸린다 — 지표가 울면 아무도 안 본다.
 * ⚠️ 법정동이 같은 것만 센다. 지역 울타리는 CV-B ② 와 같은 원칙이다.
 */
export function countSimilarPairs(
  rows: Array<{ id: string; name: string; region: string | null; sigungu: string | null; dong: string | null }>,
): { pairs: number; samples: string[] } {
  const groups = new Map<string, Array<{ id: string; name: string; b: string }>>();
  for (const r of rows) {
    if (!r.dong) continue;
    const b = bare(r.name);
    if (b.length < 4) continue;
    const k = `${r.region ?? ''}|${r.sigungu ?? ''}|${r.dong}`;
    const arr = groups.get(k) ?? [];
    arr.push({ id: r.id, name: r.name, b });
    groups.set(k, arr);
  }
  let pairs = 0;
  const samples: string[] = [];
  for (const arr of groups.values()) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], c = arr[j];
        if (a.b.includes(c.b) || c.b.includes(a.b)) {
          pairs++;
          if (samples.length < 10) samples.push(`${a.name} <-> ${c.name}`);
        }
      }
    }
  }
  return { pairs, samples };
}

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
  for (const st of ['pending', 'review', 'unmatched']) {
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
