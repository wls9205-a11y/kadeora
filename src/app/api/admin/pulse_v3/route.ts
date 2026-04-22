import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/admin/pulse_v3 — v3 realtime admin pulse.
 *   4 뷰 병렬 fetch:
 *     v_admin_master_v3 (1 row)
 *     v_admin_action_items (전체)
 *     v_admin_whale_unconverted (TOP 10, pv 내림차순)
 *     v_admin_behavior_conversion_matrix (16 row)
 */
export async function GET(_req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;

  const [masterR, actionR, whaleR, matrixR] = await Promise.all([
    admin.from('v_admin_master_v3').select('*').maybeSingle(),
    admin.from('v_admin_action_items').select('*').order('severity', { ascending: true }),
    admin.from('v_admin_whale_unconverted').select('*').order('pv', { ascending: false }).limit(10),
    admin.from('v_admin_behavior_conversion_matrix').select('*'),
  ]);

  return NextResponse.json({
    master: masterR.data ?? null,
    actionItems: actionR.data ?? [],
    whales: whaleR.data ?? [],
    behaviorMatrix: matrixR.data ?? [],
    errors: {
      master: masterR.error?.message ?? null,
      action: actionR.error?.message ?? null,
      whale: whaleR.error?.message ?? null,
      matrix: matrixR.error?.message ?? null,
    },
  });
}
