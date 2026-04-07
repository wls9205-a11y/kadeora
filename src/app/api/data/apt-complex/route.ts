import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse, NextRequest } from 'next/server';
import { exportData } from '@/lib/data-export';

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'csv';
    const sb = await createSupabaseServer();
    const { data } = await (sb as any).from('apt_sites')
      .select('name,region,sigungu,address,total_units,built_year,builder,developer')
      .order('total_units', { ascending: false, nullsFirst: false })
      .limit(5000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    return exportData({
      data, headers: ['단지명','지역','시군구','주소','총세대','준공년도','시공사','시행사'],
      filename: 'kadeora_apt_complex', sheetName: '단지백과',
    }, format);
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
