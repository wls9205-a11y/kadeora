import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

/**
 * price_change_1y 자동 계산 크론
 * 매주 월요일 06:30 (vercel.json)
 *
 * s217: 기존 in-memory JS 집계 (apt_transactions 621k row × 4 윈도우 fetch + Promise.allSettled
 * 단지별 update) 가 PostgREST 1k cap 으로 데이터 잘림 + 메모리 부담 + 단지별 update 수천 round-trip.
 * → SQL aggregate RPC `calc_apt_price_change_1y()` 단일 호출로 전환.
 *
 * RPC 동작 (apt_transactions idx_apt_tx_name_date_cover 인덱스 활용):
 *   Phase 1: 최근 3개월 (≥2건) vs 12-15개월 전 (≥2건) → AVG 비교
 *   Phase 2: 최근 6개월 (≥1건) vs 12-18개월 전 (≥1건) → Phase 1 미커버 단지만
 *   |change_pct| < 200 필터 (이상치 제거)
 *   apt_complex_profiles UPDATE 단일 트랜잭션
 */
export async function GET() {
  const result = await withCronLogging('price-change-calc', async () => {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('calc_apt_price_change_1y');
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      processed: row?.updated_count ?? 0,
      metadata: {
        updated: row?.updated_count ?? 0,
        phase1: row?.phase1_count ?? 0,
        phase2: row?.phase2_count ?? 0,
      },
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
