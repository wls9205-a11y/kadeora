export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export const GET = withCronAuth(async (req: NextRequest) => {
  const sb = getSupabaseAdmin();
  const results: Record<string, string> = {};

  // mv_apt_overview + mv_unsold_summary
  try {
    const { error } = await (sb as any).rpc('refresh_apt_overview');
    if (error) throw error;
    results.apt_overview = 'ok';
  } catch (err: any) {
    console.error('[refresh-mv] apt_overview:', err.message);
    results.apt_overview = err.message;
  }

  // mv_seo_portal_stats — 1시간마다 refresh (get_seo_portal_stats 24,000번 호출 → 캐시로 대체)
  try {
    await (sb as any).rpc('refresh_seo_stats');
    results.seo_portal_stats = 'ok';
  } catch {
    // RPC 없으면 직접 SQL
    try {
      await sb.from('mv_seo_portal_stats' as any).select('total').limit(1);
      // Supabase REST로는 REFRESH 불가 — raw SQL 필요
      results.seo_portal_stats = 'skipped (use pg cron)';
    } catch (e2: any) {
      results.seo_portal_stats = e2.message;
    }
  }

  return NextResponse.json({ ok: true, refreshed: results });
});
