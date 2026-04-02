import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data } = await (sb as any).from('stock_symbols')
      .select('symbol,name,market,sector,sub_sector,price,change_pct,market_cap')
      .order('sector', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    const headers = ['종목코드','종목명','시장','업종','세부업종','현재가','등락률','시가총액'];
    const rows = data.map((r: Record<string, unknown>) =>
      Object.keys(r).map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kadeora_stock_sectors_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
