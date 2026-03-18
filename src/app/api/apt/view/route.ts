import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false });
    const sb = await createSupabaseServer();
    const { data: apt } = await sb.from('apt_subscriptions').select('view_count').eq('id', id).single();
    await sb.from('apt_subscriptions').update({ view_count: (apt?.view_count ?? 0) + 1 }).eq('id', id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
