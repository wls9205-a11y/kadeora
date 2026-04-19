/**
 * [CI-v1 Session D6] indexnow-urgent — 5m 긴급 IndexNow (is_urgent=true LIMIT 100)
 *
 * indexnow_queue.status='pending' AND is_urgent=true → submitIndexNow → status='submitted'
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { submitIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LOCK_KEY = 'indexnow-urgent';
const BATCH_SIZE = 100;

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
      .eq('is_urgent', true)
      .lt('attempt_count', 3)
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (!rows || rows.length === 0) return NextResponse.json({ success: true, submitted: 0 });

    const urls = rows.map((r: any) => r.url).filter(Boolean);
    await submitIndexNow(urls);

    await (admin as any).from('indexnow_queue').update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      attempt_count: 1,
    }).in('id', rows.map((r: any) => r.id));

    return NextResponse.json({ success: true, submitted: urls.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;
