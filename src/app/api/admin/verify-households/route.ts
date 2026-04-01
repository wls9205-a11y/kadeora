import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data } = await (sb.from('apt_subscriptions')
    .select('id, house_nm, region_nm, project_type, tot_supply_hshld_co, total_households, constructor_nm')
    .in('project_type', ['재개발', '재건축'])
    .is('total_households', null)
    .order('tot_supply_hshld_co', { ascending: false })
    .limit(50) as any);
  
  const { count } = await (sb.from('apt_subscriptions')
    .select('id', { count: 'exact', head: true })
    .in('project_type', ['재개발', '재건축'])
    .is('total_households', null) as any);

  return NextResponse.json({
    total_null: count || 0,
    items: data || [],
  });
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json();
  const { id, total_households, dong_count, max_floor } = body;

  if (!id || !total_households || total_households <= 0) {
    return NextResponse.json({ error: 'id and total_households required' }, { status: 400 });
  }

  // 검증: 공급세대수보다 작으면 거부
  const { data: row } = await (sb.from('apt_subscriptions')
    .select('tot_supply_hshld_co, house_nm')
    .eq('id', id).single() as any);

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (total_households < row.tot_supply_hshld_co) {
    return NextResponse.json({ error: `총세대(${total_households})가 공급(${row.tot_supply_hshld_co})보다 작습니다` }, { status: 400 });
  }

  const updateData: Record<string, any> = { total_households };
  if (dong_count && dong_count > 0) updateData.total_dong_count = dong_count;
  if (max_floor && max_floor > 0) updateData.max_floor = max_floor;

  await sb.from('apt_subscriptions').update(updateData).eq('id', id);

  return NextResponse.json({ 
    ok: true, 
    name: row.house_nm,
    total_households,
    supply: row.tot_supply_hshld_co,
    ratio: (total_households / row.tot_supply_hshld_co).toFixed(2),
  });
}
