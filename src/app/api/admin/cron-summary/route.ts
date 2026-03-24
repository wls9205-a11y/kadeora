import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const hours = parseInt(searchParams.get('hours') || '24');

    const sb = getSupabaseAdmin();

    // RPC 시도
    const { data: rpcData, error: rpcErr } = await sb.rpc('get_cron_summary', { p_hours: hours });
    if (!rpcErr && rpcData) {
      return NextResponse.json({ summary: rpcData });
    }

    // RPC 실패 시 직접 쿼리
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data } = await sb.from('cron_logs')
      .select('cron_name, status, duration_ms, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!data?.length) return NextResponse.json({ summary: [] });

    // 수동 집계
    const map = new Map<string, any>();
    for (const row of data) {
      if (!map.has(row.cron_name)) {
        map.set(row.cron_name, {
          cron_name: row.cron_name, total_runs: 0, success_count: 0, error_count: 0,
          durations: [], last_run: row.created_at, last_status: row.status,
        });
      }
      const m = map.get(row.cron_name)!;
      m.total_runs++;
      if (row.status === 'success') m.success_count++;
      if (row.status === 'failed') m.error_count++;
      if (row.duration_ms) m.durations.push(row.duration_ms);
    }

    const summary = [...map.values()].map(m => ({
      ...m,
      avg_duration_ms: m.durations.length > 0 ? Math.round(m.durations.reduce((a: number, b: number) => a + b, 0) / m.durations.length) : null,
      durations: undefined,
    })).sort((a, b) => b.error_count - a.error_count || new Date(b.last_run).getTime() - new Date(a.last_run).getTime());

    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
