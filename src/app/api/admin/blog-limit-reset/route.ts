import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
    const { data: profile } = await getSupabaseAdmin()
      .from('profiles').select('is_admin').eq('id', user.id).single();
    if (!(profile as { is_admin?: boolean } | null)?.is_admin)
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });

    const limit = (await req.json().catch(() => ({}))).limit ?? 10;
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('blog_publish_config')
      .update({ daily_create_limit: limit })
      .eq('id', 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, daily_create_limit: limit });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
