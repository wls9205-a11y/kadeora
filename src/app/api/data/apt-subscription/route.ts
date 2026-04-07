import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse, NextRequest } from 'next/server';
import { exportData } from '@/lib/data-export';

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'csv';
    const sb = await createSupabaseServer();
    const { data } = await (sb as any).from('apt_subscriptions')
      .select('house_nm,region_nm,hssply_adres,developer_nm,general_supply_total,special_supply_total,rcept_bgnde,rcept_endde,przwner_presnatn_de,mdatrgbn_nm')
      .order('rcept_bgnde', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (!data?.length) return NextResponse.json({ error: 'No data' }, { status: 404 });
    return exportData({
      data, headers: ['단지명','지역','주소','시행사','일반공급','특별공급','청약시작','청약마감','당첨발표','유형'],
      filename: 'kadeora_apt_subscription', sheetName: '청약일정',
    }, format);
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
