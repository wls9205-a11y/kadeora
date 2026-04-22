import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/admin/image-quality
 *   { dashboard: v_image_relevance_dashboard, histogram: bucket 5개 }
 */
export async function GET(_req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;

  const [dashR, histR] = await Promise.all([
    admin.from('v_image_relevance_dashboard').select('*'),
    admin.rpc('image_relevance_histogram'),
  ]);

  // histogram RPC 가 없으면 직접 쿼리 (fallback)
  let histogram: Array<{ bucket: string; cnt: number }> = [];
  if (histR.error || !histR.data) {
    const { data: rows } = await admin
      .from('image_relevance_queue')
      .select('relevance_score')
      .not('relevance_score', 'is', null);
    const buckets = [0, 0, 0, 0, 0];
    for (const r of (rows || []) as any[]) {
      const s = Number(r.relevance_score) || 0;
      const idx = Math.min(4, Math.floor(s / 20));
      buckets[idx]++;
    }
    histogram = [
      { bucket: '0-20', cnt: buckets[0] },
      { bucket: '20-40', cnt: buckets[1] },
      { bucket: '40-60', cnt: buckets[2] },
      { bucket: '60-80', cnt: buckets[3] },
      { bucket: '80-100', cnt: buckets[4] },
    ];
  } else {
    histogram = histR.data;
  }

  return NextResponse.json({
    dashboard: dashR.data || [],
    histogram,
    error: dashR.error?.message || null,
  });
}
