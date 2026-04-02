import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse, NextRequest } from 'next/server';
import { exportData } from '@/lib/data-export';

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'csv';
    const sb = await createSupabaseServer();
    const { data } = await (sb as any).from('unsold_apartments')
      .select('name,region,sigungu,address,total_units,unsold_units,price_per_pyeong,status,data_date')
      .order('data_date', { ascending: false, nullsFirst: false })
      .limit(3000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    return exportData({
      data, headers: ['단지명','지역','시군구','주소','총세대','미분양','평당가','상태','기준일'],
      filename: 'kadeora_apt_unsold', sheetName: '미분양현황',
    }, format);
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
