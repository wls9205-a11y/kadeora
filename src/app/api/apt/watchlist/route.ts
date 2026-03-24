import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ items: [] });

  const { data } = await sb.from('apt_watchlist').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return NextResponse.json({ items: data || [] });
  } catch (e) { console.error('[watchlist GET]', e); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const { item_type, item_id, memo } = await req.json();
  if (!item_type || !item_id) return NextResponse.json({ error: 'item_type, item_id 필요' }, { status: 400 });

  const { data: existing } = await sb.from('apt_watchlist')
    .select('id').eq('user_id', user.id).eq('item_type', item_type).eq('item_id', String(item_id)).maybeSingle();

  if (existing) {
    await sb.from('apt_watchlist').delete().eq('id', existing.id);
    return NextResponse.json({ watched: false });
  } else {
    await sb.from('apt_watchlist').insert({ user_id: user.id, item_type, item_id: String(item_id), memo: memo || null });
    return NextResponse.json({ watched: true });
  }
  } catch (e) { console.error('[watchlist POST]', e); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}
