// /admin/signup-flow 의 인앱 브라우저 funnel 카드용 데이터.
// v_signup_inapp_browser_funnel 14d 일별 + 브라우저별 14d 합계.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

interface Row {
  day: string;
  browser_type: string;
  attempts: number;
  oauth_started: number;
  oauth_callback: number;
  success: number;
  dropped_oauth_start: number;
  success_pct: number | string | null;
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const sb = getSupabaseAdmin() as any;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await sb
    .from('v_signup_inapp_browser_funnel')
    .select('*')
    .gte('day', since)
    .order('day', { ascending: false })
    .order('attempts', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: String(error.message || error), daily: [], by_browser: [] });
  }

  const rows = ((data ?? []) as Row[]).map(r => ({
    ...r,
    attempts: Number(r.attempts) || 0,
    oauth_started: Number(r.oauth_started) || 0,
    oauth_callback: Number(r.oauth_callback) || 0,
    success: Number(r.success) || 0,
    dropped_oauth_start: Number(r.dropped_oauth_start) || 0,
    success_pct: r.success_pct == null ? null : Number(r.success_pct),
  }));

  // browser 14d 합계
  const agg = new Map<string, { browser_type: string; attempts: number; oauth_started: number; oauth_callback: number; success: number }>();
  for (const r of rows) {
    const cur = agg.get(r.browser_type) ?? { browser_type: r.browser_type, attempts: 0, oauth_started: 0, oauth_callback: 0, success: 0 };
    cur.attempts += r.attempts;
    cur.oauth_started += r.oauth_started;
    cur.oauth_callback += r.oauth_callback;
    cur.success += r.success;
    agg.set(r.browser_type, cur);
  }
  const byBrowser = Array.from(agg.values())
    .map(b => ({ ...b, success_pct: b.attempts > 0 ? Math.round((b.success / b.attempts) * 1000) / 10 : 0 }))
    .sort((a, b) => b.attempts - a.attempts);

  return NextResponse.json({ ok: true, daily: rows, by_browser: byBrowser });
}
