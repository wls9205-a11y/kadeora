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

// GET: 북마크 여부 확인
export async function GET(request: NextRequest) {
  const user = await getUser();
  const postId = new URL(request.url).searchParams.get('postId');
  if (!postId) return NextResponse.json({ bookmarked: false });
  if (!user) return NextResponse.json({ bookmarked: false });
  const sb = createClient(URL_, SVC);
  const { data } = await sb.from('bookmarks').select('post_id')
    .eq('post_id', Number(postId)).eq('user_id', user.id).maybeSingle();
  return NextResponse.json({ bookmarked: !!data });
}

// POST: 북마크 토글
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  const { postId } = await request.json();
  if (!postId) return NextResponse.json({ error: 'postId 필요' }, { status: 400 });
  const sb = createClient(URL_, SVC);
  const { data: existing } = await sb.from('bookmarks').select('post_id')
    .eq('post_id', postId).eq('user_id', user.id).maybeSingle();
  if (existing) {
    await sb.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
    return NextResponse.json({ bookmarked: false });
  } else {
    await sb.from('bookmarks').insert({ post_id: postId, user_id: user.id });
    return NextResponse.json({ bookmarked: true });
  }
}