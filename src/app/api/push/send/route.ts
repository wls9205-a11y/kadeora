import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 어드민 확인
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', session.user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, body, url = '/', target = 'all', user_ids } = await req.json();

  // 구독자 목록 조회
  let query = admin.from('push_subscriptions').select('*');
  if (target === 'specific' && user_ids?.length) {
    query = query.in('user_id', user_ids);
  }
  const { data: subs } = await query;
  if (!subs?.length) return NextResponse.json({ sent: 0 });

  // DB 알림 저장 (앱 내 알림)
  const notifTarget = target === 'all'
    ? await admin.from('profiles').select('id').eq('is_deleted', false)
    : { data: (user_ids ?? []).map((id: string) => ({ id })) };

  if (notifTarget.data) {
    await admin.from('notifications').insert(
      notifTarget.data.map((p: { id: string }) => ({
        user_id: p.id, type: 'system', content: `[공지] ${title}: ${body}`, is_read: false,
      }))
    );
  }

  // Web Push 발송 (VAPID 없으면 스킵)
  let sent = 0;
  if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    for (const sub of subs) {
      try {
        const payload = JSON.stringify({ title, body, url });
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(payload.length),
            'TTL': '86400',
          },
          body: payload,
        });
        if (res.ok) sent++;
      } catch {}
    }
  } else {
    sent = notifTarget.data?.length ?? 0; // VAPID 없으면 앱 내 알림만
  }

  return NextResponse.json({ ok: true, sent, total: subs.length });
}