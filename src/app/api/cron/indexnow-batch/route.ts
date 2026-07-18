/**
 * [CI-v1 Session D6] indexnow-batch — 30m 일반 IndexNow (is_urgent=false LIMIT 500)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { submitIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LOCK_KEY = 'indexnow-batch';
// staged 롤아웃: 검증 단계 소량(10). 3,726건 한 번에 풀지 않는다.
// claude.ai 가 포털 응답 확인 후 500 으로 복원.
const BATCH_SIZE = 10;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 60,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const { data: rows } = await (admin as any)
      .from('indexnow_queue')
      .select('id, url')
      .eq('status', 'pending')
      .eq('is_urgent', false)
      .lt('attempt_count', 3)
      .order('priority', { ascending: true })
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (!rows || rows.length === 0) return NextResponse.json({ success: true, submitted: 0 });

    const urls = rows.map((r: any) => r.url).filter(Boolean);
    const result = await submitIndexNow(urls);

    // 실제 포털 수락 결과로 status 확정. 'sent' 는 CHECK 위반 → s258 회귀를 되돌림.
    // lib fallback 키로 no-op 도 해소. 진짜 제출 결과가 status 에 반영된다.
    const newStatus = result.ok ? 'submitted' : 'failed';
    const { error: updErr } = await (admin as any).from('indexnow_queue').update({
      status: newStatus,
      submitted_at: new Date().toISOString(),
      response_code: result.ok ? 200 : 0,
      attempt_count: 1,
    }).in('id', rows.map((r: any) => r.id));
    if (updErr) console.error('[indexnow-batch] queue update failed:', updErr.message);

    return NextResponse.json({ success: true, submitted: result.ok ? urls.length : 0, accepted: result.accepted, status: newStatus });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;
