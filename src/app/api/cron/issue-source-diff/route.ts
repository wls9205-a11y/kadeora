import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { dbw } from '@/lib/cron-db-log';

// ⚠️ Rule #18 정정(2026-08-27) — 캐치올은 이 줄을 «덮지 않는다». 이 선언만으로 충분하다.
//    functions 항목은 필요 없다. 그 항목은 50개가 상한이라 함부로 늘리지 않는다(Rule #112).
export const maxDuration = 120;

/**
 * 이슈 «1차 소스» diff 승격 — 정정공고 감지.
 *
 * ── 무엇을 하나 ─────────────────────────────────────────────────────────────
 * 1차 소스(청약홈)가 «이미 낸 공고를 고치는» 경우를 잡는다. 세대수가 줄거나 입주월이
 * 밀리는 것은 사람이 알아야 할 사실이고, 기사보다 먼저 우리가 안다.
 *
 * ⛔ AI 를 «부르지 않는다». draft_* 를 채우지 않는다 — 지시서가 「AI 초안 없이
 *    issue_alerts 행 생성까지」로 그은 선이다. 초안은 기존 issue-draft 가 맡는다.
 *
 * ── ⚠️ 신호를 그대로 쓰면 «거짓 정정» 이 쏟아진다 ────────────────────────────
 * `apt_change_log` 를 그대로 읽었을 때 실측(2026-08-28)으로 나온 세 종류:
 *
 *   ① null → 값        「호반써밋 풍무Ⅲ price_max: (없음) → 76,250」
 *                       ⛔ 최초 채움이다. 고친 것이 아니라 «이제 안» 것이다.
 *   ② 값 A → B → A     「신제주 동문디이스트 total_units 196→182→196,
 *                        move_in_date 202703→202706→202703」
 *                       ⛔ 정정이 아니라 «데이터 충돌» 이다. T1 이 이미 밝혔다 —
 *                          시그니처원 Ⅰ 과 Ⅱ 는 «서로 다른 현장» 인데 이름이 겹쳐
 *                          두 소스가 번갈아 덮고 있다. 이걸 「정정공고」로 내보내면
 *                          우리가 매일 거짓말을 하게 된다.
 *   ③ 값 A → B (안정)  ← «이것만» 정정으로 본다.
 *
 * ⚠️ lifecycle_stage 는 «보지 않는다». 백필이 하루에 1,000행씩 찍는 필드고
 *    (apt_change_log 에는 source 컬럼이 없어 백필을 가려낼 수도 없다),
 *    단계 변화는 A6 관측과 「최근 움직인 현장」이 이미 맡고 있다.
 */

/** 정정으로 볼 필드. ⛔ lifecycle_stage 를 넣지 말 것(위 주석). */
const WATCHED: Record<string, string> = {
  total_units: '세대수',
  move_in_date: '입주 예정',
  price_min: '최저 분양가',
  price_max: '최고 분양가',
};

type Row = { slug: string | null; field: string; old_value: string | null; new_value: string | null; changed_at: string };

const norm = (v: string | null) => (v ?? '').trim();

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('issue-source-diff', async () => {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

    // ⚠️ apt_change_log 는 생성 타입(database.ts)에 «없다». 저장소 관례대로 캐스팅한다.
    //    ⛔ 타입을 맞추려고 database.ts 를 손으로 고치지 말 것 — gen-types 가 덮는다.
    const { data, error } = await (sb as any)
      .from('apt_change_log')
      .select('slug, field, old_value, new_value, changed_at')
      .in('field', Object.keys(WATCHED))
      .gte('changed_at', since)
      .order('changed_at', { ascending: true });

    if (error) {
      console.error(`[issue-source-diff] ${error.message?.slice(0, 200)}`);
      return { processed: 0, created: 0, failed: 1, metadata: { error: error.message?.slice(0, 200) } };
    }

    const rows = (data ?? []) as unknown as Row[];
    const skipped: Record<string, number> = {};
    const bump = (k: string) => { skipped[k] = (skipped[k] ?? 0) + 1; };

    // ── ② 왕복 판정 — 같은 (현장, 필드)가 창 안에서 «되돌아온» 적이 있나 ──
    const seen = new Map<string, string[]>();
    for (const r of rows) {
      const k = `${r.slug}|${r.field}`;
      const arr = seen.get(k) ?? [];
      arr.push(norm(r.new_value));
      seen.set(k, arr);
    }
    const flapping = new Set<string>();
    for (const [k, vals] of seen) {
      // 값이 두 번 이상 나오면 되돌아온 것이다.
      if (new Set(vals).size < vals.length) flapping.add(k);
    }

    // 현장당 «가장 최근» 변화 한 건만 본다. 같은 현장으로 하루에 여러 줄을 만들지 않는다.
    const latest = new Map<string, Row>();
    for (const r of rows) latest.set(`${r.slug}|${r.field}`, r);

    let created = 0;
    for (const [k, r] of latest) {
      if (!r.slug) { bump('no_slug'); continue; }
      if (!norm(r.old_value)) { bump('first_fill'); continue; }      // ①
      if (flapping.has(k)) { bump('flapping_conflict'); continue; }  // ②
      if (norm(r.old_value) === norm(r.new_value)) { bump('no_change'); continue; }

      const { data: site } = await (sb as any)
        .from('apt_sites')
        .select('id, name, display_name, region, sigungu, is_aggregate')
        .eq('slug', r.slug)
        .maybeSingle();
      if (!site || (site as any).is_aggregate) { bump('no_site_or_aggregate'); continue; }

      const label = WATCHED[r.field];
      const name = (site as any).display_name || (site as any).name;
      const title = `${name} ${label} 정정 — ${norm(r.old_value)} → ${norm(r.new_value)}`;

      // ⚠️ 멱등. 같은 제목이 최근에 있으면 만들지 않는다.
      const { data: dup } = await (sb as any)
        .from('issue_alerts')
        .select('id')
        .eq('title', title)
        .gte('created_at', new Date(Date.now() - 14 * 86400_000).toISOString())
        .limit(1);
      if (dup && dup.length) { bump('duplicate'); continue; }

      const res = await (sb as any).from('issue_alerts').insert({
        title,
        summary: `${name}의 ${label}이(가) ${norm(r.old_value)}에서 ${norm(r.new_value)}(으)로 바뀌었습니다.`,
        category: 'apt',
        issue_type: 'source_correction',
        source_type: 'apt_source_diff',
        source_urls: [`https://kadeora.app/apt/${encodeURIComponent(r.slug)}`],
        apt_site_id: (site as any).id,
        region_sido: (site as any).region,
        region_sigungu: (site as any).sigungu,
        detected_at: r.changed_at,
        raw_data: { field: r.field, old_value: r.old_value, new_value: r.new_value, slug: r.slug },
        // ⛔ draft_* 를 채우지 않는다. 초안은 issue-draft 의 몫이다.
        is_processed: false,
      });
      // ⛔ supabase-js 는 실패해도 «던지지 않는다». dbw 가 삼켜지는 실패를 잡는다.
      dbw('issue-source-diff', `insert ${r.slug}/${r.field}`, res);
      if (!res.error) created++;
    }

    return {
      processed: rows.length,
      created,
      failed: 0,
      // ⛔ 「0건」만 찍고 끝내지 않는다. 왜 안 만들었는지가 이 크론의 절반이다.
      metadata: { window_hours: 36, changes_seen: rows.length, created, skipped },
    };
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}
