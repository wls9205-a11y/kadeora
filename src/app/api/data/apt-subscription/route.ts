import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data } = await (sb as any).from('subscription_sites')
      .select('name,region,sigungu,developer_nm,general_supply_total,special_supply_total,subscription_start,subscription_end,announcement_date,status')
      .order('subscription_start', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    const headers = ['단지명','지역','시군구','시행사','일반공급','특별공급','청약시작','청약마감','당첨발표','상태'];
    const rows = data.map((r: Record<string, unknown>) =>
      Object.keys(r).map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kadeora_apt_subscription_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
