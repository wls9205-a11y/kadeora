import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

/**
 * price_change_1y 자동 계산 크론
 * 매주 월요일 06:00 실행 (vercel.json cron schedule)
 * apt_transactions 데이터 기반으로 1년 가격 변동률 계산
 */
export async function GET() {
  const result = await withCronLogging('price-change-calc', async () => {
    const sb = getSupabaseAdmin();
    let updated = 0;

    // Phase 1: 최근 3개월 vs 12~15개월 전 (엄격 — 거래 2건 이상)
    const { error: e1 } = await sb.rpc('execute_sql_raw' as any, { sql: `
      WITH recent AS (
        SELECT apt_name, avg(deal_amount) as avg_price
        FROM apt_transactions 
        WHERE deal_date >= current_date - interval '3 months' AND deal_amount > 0
        GROUP BY apt_name HAVING count(*) >= 2
      ),
      past AS (
        SELECT apt_name, avg(deal_amount) as avg_price
        FROM apt_transactions 
        WHERE deal_date >= current_date - interval '15 months'
          AND deal_date < current_date - interval '12 months' AND deal_amount > 0
        GROUP BY apt_name HAVING count(*) >= 2
      )
      UPDATE apt_complex_profiles cp
      SET price_change_1y = round(((r.avg_price - p.avg_price) / p.avg_price * 100)::numeric, 1), updated_at = now()
      FROM recent r JOIN past p ON r.apt_name = p.apt_name
      WHERE cp.apt_name = r.apt_name AND p.avg_price > 0
        AND abs((r.avg_price - p.avg_price) / p.avg_price * 100) < 200
    ` }).catch(() => null);

    // Phase 2: 완화 — 최근 6개월 vs 12~18개월 전 (1건 이상, NULL만 채움)
    const { error: e2 } = await sb.rpc('execute_sql_raw' as any, { sql: `
      WITH recent AS (
        SELECT apt_name, avg(deal_amount) as avg_price
        FROM apt_transactions 
        WHERE deal_date >= current_date - interval '6 months' AND deal_amount > 0
        GROUP BY apt_name HAVING count(*) >= 1
      ),
      past AS (
        SELECT apt_name, avg(deal_amount) as avg_price
        FROM apt_transactions 
        WHERE deal_date >= current_date - interval '18 months'
          AND deal_date < current_date - interval '12 months' AND deal_amount > 0
        GROUP BY apt_name HAVING count(*) >= 1
      )
      UPDATE apt_complex_profiles cp
      SET price_change_1y = round(((r.avg_price - p.avg_price) / p.avg_price * 100)::numeric, 1), updated_at = now()
      FROM recent r JOIN past p ON r.apt_name = p.apt_name
      WHERE cp.apt_name = r.apt_name AND cp.price_change_1y IS NULL AND p.avg_price > 0
        AND abs((r.avg_price - p.avg_price) / p.avg_price * 100) < 200
    ` }).catch(() => null);

    // 결과 확인
    const { data: stats } = await (sb as any).from('apt_complex_profiles')
      .select('price_change_1y')
      .not('price_change_1y', 'is', null);
    updated = (stats || []).length;

    return { updated, phase1Error: e1?.message || null, phase2Error: e2?.message || null };
  });

  return NextResponse.json({ ok: true, ...result });
}
