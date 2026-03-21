import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withCronLogging } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-price', async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const today = new Date().toISOString().split('T')[0];

    // KIS API 키가 있으면 실시간 시세 갱신 (향후 구현)
    // KIS_APP_KEY, KIS_APP_SECRET 환경변수 등록 후 구현 예정

    // 현재 stock_quotes 데이터를 stock_price_history에 일일 스냅샷으로 저장
    const { data: quotes } = await supabase
      .from('stock_quotes')
      .select('symbol, price, change_pct, volume')
      .gt('price', 0);

    if (!quotes || quotes.length === 0) {
      return { processed: 0, created: 0, failed: 0, metadata: {} };
    }

    let created = 0;
    let failed = 0;

    // 배치로 처리 (50개씩)
    for (let i = 0; i < quotes.length; i += 50) {
      const batch = quotes.slice(i, i + 50);
      const rows = batch.map(q => ({
        symbol: q.symbol,
        date: today,
        close_price: q.price,
        open_price: q.price,
        high_price: q.price,
        low_price: q.price,
        volume: q.volume || 0,
        change_pct: q.change_pct || 0,
      }));

      const { error } = await supabase
        .from('stock_price_history')
        .upsert(rows, { onConflict: 'symbol,date' });

      if (!error) {
        created += rows.length;
      } else {
        // 개별 upsert 시도
        for (const row of rows) {
          const { error: singleErr } = await supabase
            .from('stock_price_history')
            .upsert(row, { onConflict: 'symbol,date' });
          if (!singleErr) created++;
          else failed++;
        }
      }
    }

    return {
      processed: quotes.length,
      created,
      failed,
      metadata: { date: today },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result });
}
