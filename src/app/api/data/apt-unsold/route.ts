import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data } = await (sb as any).from('unsold_apartments')
      .select('name,region,sigungu,address,total_units,unsold_units,price_per_pyeong,status,data_date')
      .order('data_date', { ascending: false, nullsFirst: false })
      .limit(3000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    const headers = ['단지명','지역','시군구','주소','총세대','미분양','평당가','상태','기준일'];
    const rows = data.map((r: Record<string, unknown>) =>
      Object.keys(r).map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kadeora_apt_unsold_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
