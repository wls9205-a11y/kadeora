import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data } = await sb.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (!data) {
      // 기본값으로 생성 (전부 ON — 유저가 개별적으로 끌 수 있음)
      const defaults = { user_id: user.id, push_comments: true, push_likes: true, push_follows: true, push_apt_deadline: true, push_hot_posts: true, push_stock_alert: true, push_attendance: true, push_marketing: true };
      await sb.from('notification_settings').insert(defaults);
      return NextResponse.json(defaults);
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const allowed = ['push_comments', 'push_likes', 'push_follows', 'push_apt_deadline', 'push_hot_posts', 'push_stock_alert', 'push_attendance', 'push_marketing'];
    const update: Record<string, boolean> = {};
    for (const key of allowed) {
      if (typeof body[key] === 'boolean') update[key] = body[key];
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

    // upsert
    const { data: existing } = await sb.from('notification_settings').select('user_id').eq('user_id', user.id).maybeSingle();
    if (existing) {
      await sb.from('notification_settings').update({ ...update, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    } else {
      await sb.from('notification_settings').insert({ user_id: user.id, ...update });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
