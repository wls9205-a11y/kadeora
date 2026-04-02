import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse, NextRequest } from 'next/server';
import { exportData } from '@/lib/data-export';

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'csv';
    const sb = await createSupabaseServer();
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data } = await (sb as any).from('stock_price_history')
      .select('symbol,date,open,high,low,close,volume')
      .gte('date', d30)
      .order('date', { ascending: false })
      .limit(10000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    return exportData({
      data, headers: ['종목코드','날짜','시가','고가','저가','종가','거래량'],
      filename: 'kadeora_stock_history_30d', sheetName: '가격히스토리',
    }, format);
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
