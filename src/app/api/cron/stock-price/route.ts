import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

function guessSector(name: string): string {
  if (/반도체|하이닉스|삼성전자|마이크론|엔비디아/.test(name)) return '반도체';
  if (/바이오|셀트리온|삼성바이오|유한양행|녹십자|한미약품/.test(name)) return '바이오';
  if (/금융|은행|지주|보험|증권|KB|신한|하나|우리|NH/.test(name)) return '금융';
  if (/자동차|현대차|기아|만도|한온/.test(name)) return '자동차';
  if (/배터리|에너지|SDI|에코프로|포스코퓨처/.test(name)) return '2차전지';
  if (/건설|대우|GS건설|현대건설|삼성물산/.test(name)) return '건설';
  if (/통신|SKT|KT |LG유플러스/.test(name)) return '통신';
  if (/카카오|네이버|플랫폼|엔씨소프트|크래프톤/.test(name)) return 'IT/소프트웨어';
  if (/화학|LG화학|롯데케미칼|한화솔루션/.test(name)) return '화학';
  if (/방산|한화에어|LIG넥스원|현대로템/.test(name)) return '방산';
  if (/미디어|CJ ENM|스튜디오|하이브|SM|JYP|YG/.test(name)) return '미디어';
  return '기타';
}

export async function GET(req: NextRequest) {
  try {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-price', async () => {
    const supabase = getSupabaseAdmin();
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
        .upsert(rows as any,  { onConflict: 'symbol,date' });

      if (!error) {
        created += rows.length;
      } else {
        // 개별 upsert 시도
        for (const row of rows) {
          const { error: singleErr } = await supabase
            .from('stock_price_history')
            .upsert(row as any, { onConflict: 'symbol,date' });
          if (!singleErr) created++;
          else failed++;
        }
      }
    }

    // Auto-classify sectors for stocks without one
    const { data: noSector } = await supabase
      .from('stock_quotes')
      .select('symbol, name')
      .is('sector', null);

    if (noSector?.length) {
      for (const s of noSector) {
        const sector = guessSector(s.name);
        if (sector !== '기타') {
          await supabase.from('stock_quotes').update({ sector }).eq('symbol', s.symbol);
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
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
} catch (e: unknown) {
    console.error('[cron/stock-price]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
