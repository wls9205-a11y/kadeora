import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  const body = await req.json().catch(() => null);
  if (!body?.visitor_id || !body?.path) return NextResponse.json({ ok: false });

  // 관리자 조회수 제외 + user_id 캡처
  let userId: string | null = null;
  try {
    const authSb = await createSupabaseServer();
    const { data: { user } } = await authSb.auth.getUser();
    if (user) {
      const { data: profile } = await authSb.from('profiles').select('is_admin').eq('id', user.id).single();
      if (profile?.is_admin) return NextResponse.json({ ok: true, skipped: 'admin' });
      userId = user.id;
    }
  } catch { /* fire-and-forget pageview, ignore errors */ }

  // Fire-and-forget
  const sb = getSupabaseAdmin();
  const ua = req.headers.get('user-agent') || null;
  sb.from('page_views').insert({
    visitor_id: body.visitor_id,
    user_id: userId,
    path: body.path,
    referrer: body.referrer || null,
    user_agent: ua,
  }).then(() => {});

  return NextResponse.json({ ok: true });
}
