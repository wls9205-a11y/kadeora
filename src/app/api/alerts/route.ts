import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { data } = await admin().from('price_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return NextResponse.json({ alerts: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const body = await req.json();
    const { alert_type, target_symbol, target_apt_id, condition, threshold } = body;

    if (!alert_type || !condition) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
    }

    // 유저당 알림 최대 20개
    const { count } = await admin().from('price_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_active', true);
    if ((count || 0) >= 20) {
      return NextResponse.json({ error: '알림은 최대 20개까지 설정 가능합니다' }, { status: 400 });
    }

    const { data, error } = await admin().from('price_alerts').insert({
      user_id: user.id,
      alert_type, target_symbol, target_apt_id, condition,
      threshold: threshold || null,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ alert: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    await admin().from('price_alerts')
      .update({ is_active: false })
      .eq('id', id).eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
