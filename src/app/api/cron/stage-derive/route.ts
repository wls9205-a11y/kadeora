import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { dbw } from '@/lib/cron-db-log';

// ⚠️ Rule #18 — vercel.json 의 `src/app/api` 캐치올(maxDuration 30)이 이 줄을 «덮는다».
//    functions 에 stage-derive 항목을 «반드시» 같이 둔다. 여기만 고치면 아무 일도 없다.
export const maxDuration = 120;

/**
 * H6-1 — 청약 날짜에서 단계를 유도해 «바뀐 것만» 갱신한다.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * 백필은 1회고, 단계는 «날짜가 지나면» 저절로 바뀐다. 접수 마감일 다음 날이면
 * subscription_open 은 더 이상 참이 아니다. 하루 한 번 다시 계산해야 화면이 안 늙는다.
 *
 * ── 백필과 다른 점 ──────────────────────────────────────────────────────────
 * ⚠️ 여기서는 stage_updated_at 을 «갱신한다». 백필 때는 안 했다.
 *    백필은 «우리가 값을 고친 것» 이고, 여기는 «현장이 실제로 다음 단계로 넘어간 것» 이다.
 *    그래야 A6 의 stage 관측이 진짜 변화만 잡는다.
 * ⚠️ previous_stage 도 여기서만 기록한다.
 *
 * ⛔ stage_source 가 있는 현장은 건드리지 않는다 — 사람이 정한 값이 이긴다.
 *    (뷰 v_subscription_stage_derived 가 `stage_source is null` 로 이미 거른다.
 *     단, 이 크론이 한 번 찍으면 'derived_subscription' 이 되므로 아래에서 그 값도 허용한다.)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stage-derive', async () => {
    const sb = getSupabaseAdmin();

    // ⚠️ 뷰는 stage_source is null 만 본다. 이미 우리가 찍은 건(derived_subscription)은
    //    뷰에 안 나오므로 RPC 로 직접 계산한다 — 한 문장으로 끝내 왕복을 늘리지 않는다.
    const { data, error } = await (sb as any).rpc('refresh_subscription_stages');
    if (error) {
      console.error(`[stage-derive] ${error.message?.slice(0, 200)}`);
      return { processed: 0, created: 0, failed: 1, metadata: { error: error.message?.slice(0, 200) } };
    }

    const rows = (data ?? []) as Array<{ site_id: string; from_stage: string | null; to_stage: string }>;
    if (rows.length > 0) {
      console.warn(`[stage-derive] ${rows.length}건 단계 변경`);
    }
    return {
      processed: rows.length,
      updated: rows.length,
      created: 0,
      failed: 0,
      // ⛔ 「0건」만 찍고 끝내지 않는다. 무엇이 어디로 갔는지 남긴다.
      metadata: {
        changed: rows.length,
        sample: rows.slice(0, 10).map((r) => `${r.from_stage ?? 'null'}→${r.to_stage}`),
      },
    };
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}
