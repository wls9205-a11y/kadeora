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
    const { data: rows, error: selErr } = await (admin as any)
      .from('indexnow_queue')
      .select('id, url')
      .eq('status', 'pending')
      .eq('is_urgent', false)
      .lt('attempt_count', 3)
      .order('priority', { ascending: true })
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (selErr) console.error('[indexnow-batch] select failed:', selErr.message);
    if (!rows || rows.length === 0) return NextResponse.json({ success: true, selected: 0, submitted: 0 });

    const urls = rows.map((r: any) => r.url).filter(Boolean);
    const result = await submitIndexNow(urls);

    // portals_ok/portals_total = 2xx 낸 포털 엔드포인트 수 / 전체(3). URL 수가 아니다 —
    // 각 포털은 urls 전량을 한 요청에 받는다(IndexNow all-or-nothing, 200=전량 수락).
    // 성공 시 청크 dedup+UPDATE → 실제 처리 건수 반환.
    if (result.ok) {
      const { submitted, deduped } = await markIndexNowSubmitted(admin, rows as { id: unknown; url: string }[]);
      return NextResponse.json({
        success: true, selected: rows.length, urls_sent: urls.length,
        submitted, deduped, portals_ok: result.accepted, portals_total: result.attempted, status: 'submitted',
      });
    }

    const { error: updErr } = await (admin as any).from('indexnow_queue').update({
      status: 'failed', submitted_at: new Date().toISOString(), response_code: 0, attempt_count: 1,
    }).in('id', rows.map((r: any) => r.id));
    if (updErr) console.error('[indexnow-batch] queue update failed:', updErr.message);
    return NextResponse.json({
      success: true, selected: rows.length, urls_sent: urls.length,
      submitted: 0, portals_ok: result.accepted, portals_total: result.attempted, status: 'failed',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;
