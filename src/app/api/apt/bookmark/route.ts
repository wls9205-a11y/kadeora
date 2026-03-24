import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const { aptId } = await req.json();
  if (!aptId) return NextResponse.json({ error: 'aptId 필요' }, { status: 400 });

  const { data: existing } = await supabase
    .from('apt_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('apt_id', aptId)
    .maybeSingle();

  if (existing) {
    await supabase.from('apt_bookmarks').delete().eq('id', existing.id);
    return NextResponse.json({ bookmarked: false });
  } else {
    await supabase.from('apt_bookmarks').insert({ user_id: user.id, apt_id: aptId });
    return NextResponse.json({ bookmarked: true });
  }
  } catch (e) { console.error('[bookmark POST]', e); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

export async function GET(req: NextRequest) {
  try {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ bookmarked: false });

  const { searchParams } = new URL(req.url);
  const aptId = searchParams.get('aptId');
  if (!aptId) return NextResponse.json({ bookmarked: false });

  const { data } = await supabase
    .from('apt_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('apt_id', Number(aptId))
    .maybeSingle();

  return NextResponse.json({ bookmarked: !!data });
  } catch (e) { console.error('[bookmark GET]', e); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}
