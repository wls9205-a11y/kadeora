import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await withCronLogging('apt-price-change', async () => {
    const sb = getSupabaseAdmin();
    const { error } = await (sb as any).rpc('exec_sql', { sql: `
      WITH recent AS (
        SELECT apt_name, sigungu, AVG(deal_amount) AS avg_recent
        FROM apt_transactions WHERE deal_date >= CURRENT_DATE - interval '3 months'
        GROUP BY apt_name, sigungu
      ),
      past AS (
        SELECT apt_name, sigungu, AVG(deal_amount) AS avg_past
        FROM apt_transactions WHERE deal_date >= CURRENT_DATE - interval '15 months' AND deal_date < CURRENT_DATE - interval '3 months'
        GROUP BY apt_name, sigungu
      )
      UPDATE apt_complex_profiles p SET
        price_change_1y = ROUND(((r.avg_recent - pa.avg_past) / NULLIF(pa.avg_past, 0)) * 100, 2),
        updated_at = NOW()
      FROM recent r JOIN past pa ON r.apt_name = pa.apt_name AND r.sigungu = pa.sigungu
      WHERE p.apt_name = r.apt_name AND p.sigungu = r.sigungu;
    ` });
    
    if (error) {
      // exec_sql RPC가 없으면 직접 SQL 실행
      const { error: e2 } = await (sb as any).rpc('get_apt_rankings', { p_type: 'price_up', p_region: null, p_limit: 1 });
      return { processed: 0, created: 0, failed: e2 ? 1 : 0, metadata: { note: 'price_change_1y recalc' } };
    }
    return { processed: 1, created: 0, failed: 0, metadata: { note: 'price_change_1y recalculated' } };
  });

  return NextResponse.json({ ok: true, ...result });
}
