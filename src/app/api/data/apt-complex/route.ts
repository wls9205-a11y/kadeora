import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data } = await (sb as any).from('naver_complexes')
      .select('complex_name,region,sigungu,address,total_units,completion_year,dong_count,floor_area_range')
      .order('total_units', { ascending: false, nullsFirst: false })
      .limit(5000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    const headers = ['단지명','지역','시군구','주소','총세대','준공년도','동수','면적범위'];
    const rows = data.map((r: Record<string, unknown>) =>
      Object.keys(r).map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kadeora_apt_complex_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
