import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { supabase } = auth;

    const { action, ids } = await req.json();
    if (!action || !ids?.length) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

    if (action === 'hide') {
      await supabase.from('posts').update({ is_deleted: true }).in('id', ids);
    } else if (action === 'restore') {
      await supabase.from('posts').update({ is_deleted: false }).in('id', ids);
    } else {
      return NextResponse.json({ error: '알 수 없는 액션' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, count: ids.length });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
