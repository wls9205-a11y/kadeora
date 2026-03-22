import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withCronLogging } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('exchange-rate', async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const today = new Date().toISOString().slice(0, 10);
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

    // Fallback: use existing exchange_rates table
    if (!rate) {
      const { data: existing } = await supabase.from('exchange_rates').select('rate').eq('currency_pair', 'USD/KRW').single();
      if (existing?.rate) rate = existing.rate;
    }

    if (!rate) return { processed: 0, created: 0, failed: 1 };

    // Update exchange_rates
    await supabase.from('exchange_rates').upsert({
      currency_pair: 'USD/KRW',
      rate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'currency_pair' });

    // Record history
    await supabase.from('exchange_rate_history').insert({
      currency_pair: 'USD/KRW',
      rate,
      recorded_at: new Date().toISOString(),
    });

    return { processed: 1, created: 1, failed: 0, metadata: { rate, api_calls: apiCalls } };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}
