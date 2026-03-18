import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const { platform } = await req.json();
    const ua = req.headers.get('user-agent') || '';

    let region_text = null;
    if (user) {
      const { data: profile } = await sb.from('profiles').select('region_text').eq('id', user.id).single();
      region_text = profile?.region_text || null;
    }

    await sb.from('pwa_installs').insert({
      user_id: user?.id || null,
      platform: platform || 'unknown',
      user_agent: ua.slice(0, 200),
      region_text,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
