import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  // 어드민 또는 CRON_SECRET으로 인증
  const isAdmin = await (async () => {
    try {
      const sb = await createSupabaseServer();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return false;
      const { data } = await getSupabaseAdmin().from('profiles').select('is_admin').eq('id', user.id).single();
      return !!(data as { is_admin?: boolean } | null)?.is_admin;
    } catch { return false; }
  })();

  const hasCronAuth = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!isAdmin && !hasCronAuth) return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  try {
    const { post_id, pin } = await req.json();
    if (!post_id) return NextResponse.json({ error: 'post_id 필요' }, { status: 400 });

    const admin = getSupabaseAdmin();
    // pin=true면 핀, false면 해제
    await admin.from('posts').update({ is_pinned: pin !== false }).eq('id', post_id);
    // 다른 핀 글 해제 (핀 글은 1개만)
    if (pin !== false) {
      await admin.from('posts').update({ is_pinned: false }).neq('id', post_id).eq('is_pinned', true);
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
