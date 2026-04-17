/**
 * cleanup-calc-results — 만료된 계산기 결과 정리
 * 일 1회 실행. 90일+ 지난 결과 중 view_count 5 미만은 삭제 (DB 부담 완화)
 * 인기 결과는 자동 보관.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function doWork() {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('cleanup_expired_calc_results');
  if (error) {
    return { processed: 0, failed: 1, metadata: { error: error.message } };
  }
  return { processed: data || 0, metadata: { deleted: data } };
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('cleanup-calc-results', doWork);
  return NextResponse.json(result);
});
