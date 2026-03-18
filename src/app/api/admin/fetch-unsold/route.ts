import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!process.env.UNSOLD_API_KEY) return NextResponse.json({ error: 'UNSOLD_API_KEY 미설정' }, { status: 503 });
    return NextResponse.json({ message: '준비 중' });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
