import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.visitor_id || !body?.path) return NextResponse.json({ ok: false });

  // 관리자 조회수 제외
  try {
    const authSb = await createSupabaseServer();
    const { data: { user } } = await authSb.auth.getUser();
    if (user) {
      const { data: profile } = await authSb.from('profiles').select('is_admin').eq('id', user.id).single();
      if (profile?.is_admin) return NextResponse.json({ ok: true, skipped: 'admin' });
    }
  } catch {}

  // Fire-and-forget: don't await
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  sb.from('page_views').insert({ visitor_id: body.visitor_id, path: body.path, referrer: body.referrer || null }).then(() => {}).catch(() => {});

  return NextResponse.json({ ok: true });
}
