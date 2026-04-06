import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data } = await sb.from('notification_settings')
      .select('user_id, push_comments, push_likes, push_follows, push_apt_deadline, push_stock_alert, push_daily_digest, push_attendance, push_hot_post, push_news, quiet_start, quiet_end, updated_at')
      .eq('user_id', user.id).maybeSingle();

    if (!data) {
      // 기본값 생성 — DB 실제 컬럼명 사용
      const defaults = {
        user_id: user.id,
        push_comments: true, push_likes: true, push_follows: true,
        push_apt_deadline: true, push_stock_alert: true,
        push_hot_post: true, push_news: true,
        push_attendance: true, push_daily_digest: true,
      };
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

    // DB 실제 컬럼명 + 프론트엔드 호환 매핑
    const fieldMap: Record<string, string> = {
      push_comments: 'push_comments',
      push_likes: 'push_likes',
      push_follows: 'push_follows',
      push_apt_deadline: 'push_apt_deadline',
      push_stock_alert: 'push_stock_alert',
      push_hot_post: 'push_hot_post',
      push_hot_posts: 'push_hot_post',       // 프론트 호환 (s 불일치 수용)
      push_news: 'push_news',
      push_marketing: 'push_news',            // 프론트 호환 (이름 매핑)
      push_attendance: 'push_attendance',
      push_daily_digest: 'push_daily_digest',
    };

    const update: Record<string, boolean> = {};
    for (const [frontKey, dbKey] of Object.entries(fieldMap)) {
      if (typeof body[frontKey] === 'boolean') update[dbKey] = body[frontKey];
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
