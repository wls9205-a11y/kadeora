import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse, NextRequest } from 'next/server';
import { exportData } from '@/lib/data-export';

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'csv';
    const sb = await createSupabaseServer();
    const { data } = await (sb as any).from('stock_quotes')
      .select('symbol,name,market,sector,price,change_pct,market_cap,volume,updated_at')
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    return exportData({
      data, headers: ['종목코드','종목명','시장','섹터','현재가','등락률','시가총액','거래량','업데이트'],
      filename: 'kadeora_stock_prices', sheetName: '전종목시세',
    }, format);
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
