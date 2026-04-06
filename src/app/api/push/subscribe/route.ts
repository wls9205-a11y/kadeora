import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * 푸시 구독 API — 로그인/비로그인 모두 지원
 *
 * 로그인: user_id로 upsert (onConflict: user_id)
 * 비로그인: visitor_id + endpoint로 upsert (onConflict: endpoint)
 *
 * 기존 버그: 비로그인 시 401 반환 → 브라우저 permission은 granted인데 DB 저장 안 됨
 * 수정: visitor_id 기반 저장 허용
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const body = await req.json();
    const { subscription, visitor_id } = body;
    if (!subscription?.endpoint) return NextResponse.json({ error: 'No endpoint' }, { status: 400 });

    const admin = getSupabaseAdmin();

    // 로그인 유저 확인 (실패해도 비로그인으로 계속)
    let userId: string | null = null;
    try {
      const sb = await createSupabaseServer();
      const { data: { user } } = await sb.auth.getUser();
      if (user) userId = user.id;
    } catch { /* 비로그인 — 계속 진행 */ }

    const record: Record<string, any> = {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
      updated_at: new Date().toISOString(),
    };

    if (userId) {
      record.user_id = userId;
    } else if (visitor_id) {
      record.visitor_id = visitor_id;
    }

    // endpoint 기반 upsert (중복 방지)
    await (admin as any).from('push_subscriptions').upsert(record, { onConflict: 'endpoint' });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[push/subscribe]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    await admin.from('push_subscriptions').delete().eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[push/subscribe]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
