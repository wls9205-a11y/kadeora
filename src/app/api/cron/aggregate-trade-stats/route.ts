import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withCronLogging } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('aggregate-trade-stats', async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Call the RPC to aggregate
    const { error } = await supabase.rpc('aggregate_trade_monthly_stats');
    if (error) throw new Error(error.message);

    // Check for significant changes and alert
    const { data: stats } = await supabase.from('apt_trade_monthly_stats')
      .select('*').order('stat_month', { ascending: false }).limit(40);

    if (stats && stats.length > 1) {
      // Group by region, compare latest 2 months
      const byRegion: Record<string, any[]> = {};
      for (const s of stats) {
        if (!byRegion[s.region_nm]) byRegion[s.region_nm] = [];
        byRegion[s.region_nm].push(s);
      }

      for (const [region, months] of Object.entries(byRegion)) {
        if (months.length < 2) continue;
        const latest = months[0];
        const prev = months[1];
        if (!prev.avg_price || !latest.avg_price) continue;
        const changePct = ((latest.avg_price - prev.avg_price) / prev.avg_price) * 100;

        if (Math.abs(changePct) > 10) {
          await supabase.from('admin_alerts').insert({
            type: 'system',
            severity: changePct > 0 ? 'warning' : 'info',
            title: `실거래가 ${changePct > 0 ? '급등' : '급락'}: ${region}`,
            message: `전월 대비 ${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}% (${(prev.avg_price/10000).toFixed(1)}억 → ${(latest.avg_price/10000).toFixed(1)}억)`,
          });
        }
      }
    }

    return { processed: stats?.length || 0, created: stats?.length || 0, failed: 0 };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}
