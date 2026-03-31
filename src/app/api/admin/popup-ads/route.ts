import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const COLS = 'id, title, content, image_url, link_url, link_label, position, display_type, target_pages, start_date, end_date, is_active, priority, dismiss_duration_hours, max_impressions, current_impressions, click_count, created_at, updated_at';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    // 어드민 쿠키 인증 폴백
    const sb = getSupabaseAdmin() as any;
    const token = req.cookies.get('sb-access-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = getSupabaseAdmin() as any;
  const { data, error } = await sb.from('popup_ads').select(COLS).order('priority', { ascending: false }).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ popups: data });
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin() as any;
  const token = req.cookies.get('sb-access-token')?.value;
  if (token) {
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, id, ...fields } = body;

  if (action === 'create') {
    const { data, error } = await sb.from('popup_ads').insert(fields).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ popup: data });
  }

  if (action === 'update' && id) {
    fields.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('popup_ads').update(fields).eq('id', id).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ popup: data });
  }

  if (action === 'delete' && id) {
    const { error } = await sb.from('popup_ads').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'toggle' && id) {
    const { data: current } = await sb.from('popup_ads').select('is_active').eq('id', id).single();
    const { data, error } = await sb.from('popup_ads').update({ is_active: !current?.is_active, updated_at: new Date().toISOString() }).eq('id', id).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ popup: data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
