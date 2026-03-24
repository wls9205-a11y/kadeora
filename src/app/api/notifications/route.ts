import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const rl = await rateLimit(request); if (!rl) return rateLimitResponse();
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 100);
    const offset = Number(searchParams.get('offset')) || 0;
    const unreadOnly = searchParams.get('unread') === 'true';
    const supabase = getSupabaseAdmin();
    let query = supabase.from('notifications').select('*', { count: 'exact' })
      .eq('user_id', user.id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (unreadOnly) query = query.eq('is_read', false);
    const { data, error, count } = await query;
    if (error) throw error;
    const { count: unreadCount } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
    return NextResponse.json({ success: true, data, total: count || 0, unread: unreadCount || 0 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // notifications/page.tsx 에서 { all: true } 또는 { id: string } 으로 보냄
    if (body.all === true || body.markAllRead === true) {
      await supabase.from('notifications').update({ is_read: true })
        .eq('user_id', user.id).eq('is_read', false);
      return NextResponse.json({ success: true, message: '전체 읽음 처리' });
    }

    const notifId = body.id ?? body.notificationId;
    if (notifId) {
      await supabase.from('notifications').update({ is_read: true })
        .eq('id', notifId).eq('user_id', user.id);
      return NextResponse.json({ success: true, message: '읽음 처리' });
    }

    return NextResponse.json({ success: false, error: 'id 또는 all 필드 필요' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}