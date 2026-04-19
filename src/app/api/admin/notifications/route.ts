/**
 * [NOTIFY-BELL] 세션 140 — 앱 내 벨 알림 API
 *
 * GET: 본인 수신함 조회 (최근 50건 + unread count)
 *      ?unread_only=1 옵션
 * PATCH: read_at 갱신
 *      body: { id: number } 또는 { all: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unread_only') === '1';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);

  const { admin, user } = auth;

  let q = (admin as any).from('notification_bell')
    .select('id, type, title, body, data, url, read_at, created_at')
    .eq('target_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (unreadOnly) q = q.is('read_at', null);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // unread count (별도)
  const { count: unreadCount } = await (admin as any)
    .from('notification_bell')
    .select('id', { count: 'exact', head: true })
    .eq('target_user_id', user.id)
    .is('read_at', null);

  return NextResponse.json({ ok: true, rows: data || [], unread_count: unreadCount || 0 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const { admin, user } = auth;

  if (body?.all === true) {
    const { error } = await (admin as any)
      .from('notification_bell')
      .update({ read_at: new Date().toISOString() })
      .eq('target_user_id', user.id)
      .is('read_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, mode: 'all' });
  }

  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await (admin as any)
    .from('notification_bell')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('target_user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
