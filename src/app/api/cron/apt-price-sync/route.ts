import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;

/**
 * 가격 데이터 자동 싱크 크론
 * 
 * apt_sites에 가격이 없는 현장에 대해 3가지 소스에서 자동으로 채움:
 * 1. apt_subscriptions house_type_info → 분양가 min/max
 * 2. apt_transactions → 실거래 min/max  
 * 3. unsold_apts → 미분양 분양가
 * 
 * 스케줄: 매일 1회 (0 3 * * *)
 */

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('apt-price-sync', async () => {
    const sb = getSupabaseAdmin();

    // [패치 P4 §4-2] 순차 왕복 → RPC 한 번.
    //
    //   이전 구현은 apt_subscriptions 2,715건을 전량 로드한 뒤 «행마다»
    //   apt_sites select + update 를 돌았고, apt_transactions·unsold_apts 도 같은
    //   방식이었다. 왕복 3,000~6,000회다. maxDuration 120 인데 코드는 100,000ms 에서
    //   끊으려 했으니 함수가 먼저 죽고, withCronLogging 이 종료를 못 써서 감시자가
    //   15분 뒤 timeout 으로 강제 마감했다 — 그래서 30일 성공 0 이었다.
    //
    //   세 루프 전부 이름 매칭 + min/max 집계라 SQL 로 내려간다.
    //   sync_apt_prices() 는 DB 담당 배포분(security definer, service_role 만 EXECUTE).
    //   거래 2건 이상 조건과 `price_min is null or 0` 대상 조건은 RPC 안에 있다.
    const { data, error } = await (sb as any).rpc('sync_apt_prices');
    if (error) throw new Error(`sync_apt_prices_failed: ${error.message}`);

    const r = (data || {}) as Record<string, number>;
    const synced = Number(r.total ?? 0);

    // 최종 가격 현황 통계
    const { count: total } = await sb.from('apt_sites')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    const { count: hasPrice } = await sb.from('apt_sites')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('price_min', 0);

    return {
      processed: synced,
      created: synced,
      updated: synced,
      failed: 0,
      metadata: {
        from_subscriptions: r.from_subscriptions ?? 0,
        from_trades: r.from_trades ?? 0,
        from_unsold: r.from_unsold ?? 0,
        total_sites: total,
        with_price: hasPrice,
        coverage: total ? `${Math.round(((hasPrice || 0) / total) * 100)}%` : '0%',
      },
    };
  });

  if (!result.success) return NextResponse.json({ ok: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
});
