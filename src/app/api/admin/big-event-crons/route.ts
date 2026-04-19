/**
 * 세션 139 [CRON-HEALTH-DASHBOARD] — Big Event Phase 2 cron 5개 상태 집계
 *
 * GET: 최근 실행 status/경과/카운트 반환
 * POST: 특정 cron 수동 실행 (CRON_SECRET으로 내부 호출)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const CRONS: { key: string; vercelPath: string; pgCronLogName: string; label: string }[] = [
  { key: 'big-event-news-detect', vercelPath: '/api/cron/big-event-news-detect', pgCronLogName: 'big-event-news-detect', label: '🔍 뉴스 감지' },
  { key: 'big-event-fact-refresh', vercelPath: '/api/cron/big-event-fact-refresh', pgCronLogName: 'big-event-fact-refresh', label: '🧪 팩트 점수 갱신' },
  { key: 'subscription-big-event-bridge', vercelPath: '/api/cron/subscription-big-event-bridge', pgCronLogName: 'subscription-big-event-bridge', label: '🌉 청약 → big_event 승격' },
  { key: 'subscription-prebrief-generator', vercelPath: '/api/cron/subscription-prebrief-generator', pgCronLogName: 'subscription-prebrief-generator', label: '📝 D-30/7/1 draft' },
  { key: 'big-event-auto-pillar-draft', vercelPath: '/api/cron/big-event-auto-pillar-draft', pgCronLogName: 'big-event-auto-pillar-draft', label: '🏛️ Pillar auto-draft' },
];

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const sb = getSupabaseAdmin();
  const out: any[] = [];
  for (const c of CRONS) {
    const { data } = await sb.from('cron_logs')
      .select('status, started_at, finished_at, duration_ms, records_processed, records_created, records_failed, error_message, metadata')
      .or(`cron_name.eq.${c.pgCronLogName},cron_name.eq.pg_cron_${c.pgCronLogName}`)
      .order('started_at', { ascending: false })
      .limit(1);
    const row: any = (data && data[0]) || null;
    out.push({
      key: c.key,
      label: c.label,
      path: c.vercelPath,
      last_status: row?.status || 'no_data',
      last_started_at: row?.started_at || null,
      last_finished_at: row?.finished_at || null,
      last_duration_ms: row?.duration_ms || null,
      processed: row?.records_processed ?? 0,
      created: row?.records_created ?? 0,
      failed: row?.records_failed ?? 0,
      error: row?.error_message || null,
    });
  }
  return NextResponse.json({ crons: out, ts: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const key = String(body?.key || '');
  const target = CRONS.find((c) => c.key === key);
  if (!target) return NextResponse.json({ error: 'unknown cron key' }, { status: 400 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET missing' }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  try {
    const res = await fetch(`${base}${target.vercelPath}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(290_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, status: res.status, result: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'fetch failed' }, { status: 502 });
  }
}
