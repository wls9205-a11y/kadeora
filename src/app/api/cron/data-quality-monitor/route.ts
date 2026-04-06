import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('data-quality-monitor', async () => {
    const admin = getSupabaseAdmin();
    const alerts: string[] = [];

    // === 주식 품질 점수 일괄 재계산 ===
    await (admin as any).rpc('recalc_stock_quality_scores').catch(() => {});

    // === 이상치 탐지 ===

    // 1. 시총 = 0인 활성 종목
    const { count: zeroCapCount } = await (admin as any).from('stock_quotes')
      .select('symbol', { count: 'exact', head: true })
      .eq('is_active', true).eq('market_cap', 0).gt('price', 0);
    if ((zeroCapCount || 0) > 10) alerts.push(`시총=0 종목 ${zeroCapCount}건`);

    // 2. PER NULL 비율
    const { count: perNull } = await admin.from('stock_quotes')
      .select('symbol', { count: 'exact', head: true })
      .eq('is_active', true).is('per', null);
    const { count: totalActive } = await admin.from('stock_quotes')
      .select('symbol', { count: 'exact', head: true })
      .eq('is_active', true);
    const perPct = totalActive ? Math.round(((perNull || 0) / totalActive) * 100) : 100;
    if (perPct > 50) alerts.push(`PER NULL 비율 ${perPct}%`);

    // 3. 7일 이상 미갱신 종목
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: staleCount } = await admin.from('stock_quotes')
      .select('symbol', { count: 'exact', head: true })
      .eq('is_active', true).lt('updated_at', weekAgo);
    if ((staleCount || 0) > 20) alerts.push(`7일+ 미갱신 ${staleCount}건`);

    // 4. 부동산 인근역 NULL 비율
    const { count: noStation } = await (admin as any).from('apt_sites')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true).or('nearby_station.is.null,nearby_station.eq.');
    const { count: totalApt } = await (admin as any).from('apt_sites')
      .select('id', { count: 'exact', head: true }).eq('is_active', true);
    const stationPct = totalApt ? Math.round(((noStation || 0) / totalApt) * 100) : 100;

    // 5. 부동산 품질 점수 재계산
    await (admin as any).from('apt_sites').update({ data_quality_score: 100 })
      .eq('is_active', true)
      .not('builder', 'is', null).not('total_units', 'is', null)
      .not('nearby_station', 'is', null).not('price_min', 'is', null);

    // 알림 기록
    if (alerts.length > 0) {
      await admin.from('admin_alerts').insert({
        type: 'data_quality',
        severity: 'warning',
        title: '데이터 품질 경고',
        message: alerts.join(' | '),
        metadata: { per_null_pct: perPct, zero_cap: zeroCapCount, stale: staleCount, no_station_pct: stationPct },
      });
    }

    return {
      processed: 1,
      metadata: {
        stock: { total: totalActive, per_null: perNull, per_null_pct: perPct, zero_cap: zeroCapCount, stale: staleCount },
        apt: { total: totalApt, no_station: noStation, no_station_pct: stationPct },
        alerts: alerts.length,
      },
    };
  });
  return NextResponse.json(result);
}
