import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('chat_messages')
      .select('id, content, created_at, profiles:user_id(nickname)')
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ messages: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    await supabase.from('chat_messages').delete().eq('id', id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
