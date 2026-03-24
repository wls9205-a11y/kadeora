import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { data: existing } = await sb
      .from('invite_codes')
      .select('code')
      .eq('creator_id', user.id)
      .maybeSingle();

    if (existing?.code) {
      return NextResponse.json({ code: existing.code });
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await sb
      .from('invite_codes')
      .insert({ code, creator_id: user.id });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
