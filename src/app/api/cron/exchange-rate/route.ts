export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('exchange-rate', async () => {
    const supabase = getSupabaseAdmin();
    const _today = new Date().toISOString().slice(0, 10);
    let rate = 0;
    let apiCalls = 0;

    // Try external API first
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(10000) });
      apiCalls = 1;
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.KRW) rate = data.rates.KRW;
      }
    } catch {}

    // Fallback: use existing exchange_rate_history table
    if (!rate) {
      const { data: existing } = await supabase.from('exchange_rate_history').select('rate').eq('currency_pair', 'USD/KRW').order('recorded_at', { ascending: false }).limit(1).single();
      if (existing?.rate) rate = Number(existing.rate);
    }

    if (!rate) return { processed: 0, created: 0, failed: 1 };

    // Update exchange_rates
    await supabase.from('exchange_rates').upsert({
      base_currency: 'KRW',
      rates: { 'USD/KRW': rate } as Record<string, number>,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'base_currency' });

    // Record history
    await supabase.from('exchange_rate_history').insert({
      currency_pair: 'USD/KRW',
      rate,
      recorded_at: new Date().toISOString(),
    });

    return { processed: 1, created: 1, failed: 0, metadata: { rate, api_calls: apiCalls } };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
