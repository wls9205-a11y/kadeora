import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data } = await (sb as any).from('stock_price_history')
      .select('symbol,date,open,high,low,close,volume')
      .gte('date', d30)
      .order('date', { ascending: false })
      .limit(10000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    const headers = ['종목코드','날짜','시가','고가','저가','종가','거래량'];
    const rows = data.map((r: Record<string, unknown>) =>
      Object.keys(r).map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kadeora_stock_history_30d_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
