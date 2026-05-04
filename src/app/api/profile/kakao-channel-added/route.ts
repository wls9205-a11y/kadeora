import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 5;

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();

  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { error } = await (admin as any)
      .from('profiles')
      .update({
        kakao_channel_added: true,
        kakao_channel_added_at: now,
      })
      .eq('id', user.id);

    if (error) {
      console.error('[kakao-channel-added] update', error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[kakao-channel-added]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
