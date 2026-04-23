import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;

  const minPv = parseInt(req.nextUrl.searchParams.get('min_pv') || '10', 10);
  const { data, error } = await admin.rpc('admin_export_whale_targets', { p_min_pv: minPv });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = ['visitor_id', 'pv', 'active_days', 'uniq_pages', 'deep_reads', 'last_seen_kst', 'primary_interest', 'top_pages'];
  const rows = (data as any[]) || [];
  const csv = [
    headers.join(','),
    ...rows.map((r) => [
      r.visitor_id, r.pv, r.active_days, r.uniq_pages, r.deep_reads,
      r.last_seen_kst, r.primary_interest,
      `"${(r.top_pages || []).join(' | ')}"`,
    ].join(',')),
  ].join('\n');

  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="whale_targets_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
