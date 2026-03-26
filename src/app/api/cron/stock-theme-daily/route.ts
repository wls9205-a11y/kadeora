export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  try {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-theme-daily', async () => {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const { data: themes } = await supabase.from('stock_themes').select('id,theme_name,change_pct,description,related_symbols,is_hot,date');
    const { data: stocks } = await supabase.from('stock_quotes').select('symbol, change_pct').in('market', ['KOSPI', 'KOSDAQ']);

    if (!themes?.length || !stocks?.length) return { processed: 0, created: 0, failed: 0 };

    const stockMap = new Map(stocks.map(s => [s.symbol, s.change_pct || 0]));
    let created = 0;

    for (const theme of themes) {
      const symbols = theme.related_symbols || [];
      const pcts = symbols.map((s: string) => stockMap.get(s)).filter((v: any) => v !== undefined) as number[];
      if (pcts.length === 0) continue;

      const avg = +(pcts.reduce((a: number, b: number) => a + b, 0) / pcts.length).toFixed(2);
      const topSymbol = symbols.reduce((best: string, sym: string) => {
        const cur = stockMap.get(sym) || 0;
        const bestVal = stockMap.get(best) || 0;
        return Math.abs(cur) > Math.abs(bestVal) ? sym : best;
      }, symbols[0]);

      // stock_theme_history: 실제 DB 컬럼은 recorded_date, avg_change_rate, top_stocks
      await supabase.from('stock_theme_history').upsert({
        theme_name: theme.theme_name,
        recorded_date: today,
        avg_change_rate: avg,
        top_stocks: { top_symbol: topSymbol, stock_count: pcts.length, symbols: symbols.slice(0, 5) },
      }, { onConflict: 'theme_name,recorded_date' });

      // Update theme's change_pct
      await supabase.from('stock_themes').update({ change_pct: avg }).eq('id', theme.id);
      created++;
    }

    return { processed: themes.length, created, failed: 0 };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
} catch (e: unknown) {
    console.error('[cron/stock-theme-daily]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
