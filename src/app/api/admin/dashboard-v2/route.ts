import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/admin/dashboard-v2
 *   { trends: v_admin_dashboard_v2[최근 14일], cta: v_admin_cta_analysis TOP 15, matrix: v_admin_cta_by_page }
 */
export async function GET(_req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;

  const fourteenAgo = new Date(Date.now() - 14 * 24 * 3600_000).toISOString().slice(0, 10);

  const [trendsR, ctaR, matrixR] = await Promise.all([
    admin.from('v_admin_dashboard_v2').select('*').gte('dt', fourteenAgo).order('dt', { ascending: true }),
    admin.from('v_admin_cta_analysis').select('*').order('views', { ascending: false }).limit(15),
    admin.from('v_admin_cta_by_page').select('*').order('ctr_pct', { ascending: false }).limit(80),
  ]);

  return NextResponse.json({
    trends: trendsR.data || [],
    cta: ctaR.data || [],
    matrix: matrixR.data || [],
    error: trendsR.error?.message || ctaR.error?.message || matrixR.error?.message || null,
  });
}
