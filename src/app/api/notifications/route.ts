import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 100);
    const offset = Number(searchParams.get('offset')) || 0;
    const unreadOnly = searchParams.get('unread') === 'true';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let query = supabase.from('notifications').select('*', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (unreadOnly) query = query.eq('is_read', false);
    const { data, error, count } = await query;
    if (error) throw error;
    const { count: unreadCount } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
    return NextResponse.json({ success: true, data, total: count || 0, unread: unreadCount || 0 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    const { notificationId, markAllRead } = await request.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    if (markAllRead) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      return NextResponse.json({ success: true, message: '전체 읽음 처리' });
    }
    if (notificationId) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', user.id);
      return NextResponse.json({ success: true, message: '읽음 처리' });
    }
    return NextResponse.json({ success: false, error: 'notificationId 또는 markAllRead 필요' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}
