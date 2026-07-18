/**
 * [CI-v1 Session D6] indexnow-batch — 30m 일반 IndexNow (is_urgent=false LIMIT 500)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { submitIndexNow, markIndexNowSubmitted } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LOCK_KEY = 'indexnow-batch';
const BATCH_SIZE = 500;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 60,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    // 진단(임시): batch 가 왜 pending 을 못 집는지 규명. pending 을 is_urgent 값별로 카운트.
    // 가설: normal 행이 is_urgent=NULL 이면 .eq('is_urgent',false) 가 NULL 을 안 잡아 selected=0.
    const pendingCount = async (f?: (b: any) => any): Promise<number> => {
      let q = (admin as any).from('indexnow_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if (f) q = f(q);
      const { count } = await q;
      return count ?? -1;
    };
    const [pendTotal, pendFalse, pendNull, pendTrue] = await Promise.all([
      pendingCount(),
      pendingCount((q) => q.eq('is_urgent', false)),
      pendingCount((q) => q.is('is_urgent', null)),
      pendingCount((q) => q.eq('is_urgent', true)),
    ]);

    const { data: rows, error: selErr } = await (admin as any)
      .from('indexnow_queue')
      .select('id, url')
      .eq('status', 'pending')
      .eq('is_urgent', false)
      .lt('attempt_count', 3)
      .order('priority', { ascending: true })
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    const diag = {
      pending_total: pendTotal, pending_false: pendFalse, pending_null: pendNull, pending_true: pendTrue,
      selected: rows?.length ?? 0, select_error: selErr?.message ?? null,
    };
    console.log('[indexnow-batch] DIAG', JSON.stringify(diag));

    if (!rows || rows.length === 0) return NextResponse.json({ success: true, submitted: 0, diag });

    const urls = rows.map((r: any) => r.url).filter(Boolean);
    const result = await submitIndexNow(urls);
    console.log('[indexnow-batch] submit', JSON.stringify(result));

    // status 는 실제 포털 수락 결과. 성공 시 청크 dedup+UPDATE → 실제 처리 건수 반환.
    if (result.ok) {
      const { submitted, deduped } = await markIndexNowSubmitted(admin, rows as { id: unknown; url: string }[]);
      console.log('[indexnow-batch] marked', JSON.stringify({ submitted, deduped }));
      return NextResponse.json({ success: true, submitted, deduped, portals_ok: result.accepted, status: 'submitted', diag });
    }

    const { error: updErr } = await (admin as any).from('indexnow_queue').update({
      status: 'failed', submitted_at: new Date().toISOString(), response_code: 0, attempt_count: 1,
    }).in('id', rows.map((r: any) => r.id));
    if (updErr) console.error('[indexnow-batch] queue update failed:', updErr.message);
    return NextResponse.json({ success: true, submitted: 0, portals_ok: result.accepted, status: 'failed', diag });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;
