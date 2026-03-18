import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { post_id, platform } = await req.json();
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('share_logs').insert({ post_id, platform, user_id: user?.id || null });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
