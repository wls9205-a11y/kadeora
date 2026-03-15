import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUser() {
  const cs = await cookies();
  const sb = createServerClient(URL_, ANON, { cookies: { getAll() { return cs.getAll(); }, setAll() {} } });
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// GET: 팔로우 여부 + 카운트
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get('targetId');
  if (!targetId) return NextResponse.json({ following: false, followers: 0, following_count: 0 });
  const user = await getUser();
  const sb = createClient(URL_, SVC);
  const [{ count: followers }, { count: following_count }, followCheck] = await Promise.all([
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', targetId),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
    user ? sb.from('follows').select('follower_id').eq('follower_id', user.id).eq('followee_id', targetId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return NextResponse.json({ following: !!(followCheck as { data: unknown }).data, followers: followers ?? 0, following_count: following_count ?? 0 });
}

// POST: 팔로우 토글
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  const { targetId } = await request.json();
  if (!targetId || targetId === user.id) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  const sb = createClient(URL_, SVC);
  const { data: existing } = await sb.from('follows').select('follower_id')
    .eq('follower_id', user.id).eq('followee_id', targetId).maybeSingle();
  if (existing) {
    await sb.from('follows').delete().eq('follower_id', user.id).eq('followee_id', targetId);
    await sb.from('profiles').update({ following_count: sb.rpc('decrement_likes', { row_id: 0 }) });
    return NextResponse.json({ following: false });
  } else {
    await sb.from('follows').insert({ follower_id: user.id, followee_id: targetId });
    return NextResponse.json({ following: true });
  }
}