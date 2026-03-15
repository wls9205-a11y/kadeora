import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    const { postId } = await request.json();
    if (!postId) return NextResponse.json({ success: false, error: 'postId 필요' }, { status: 400 });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: existing } = await supabase.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
    let liked: boolean;
    if (existing) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      await supabase.rpc('decrement_likes', { row_id: postId });
      liked = false;
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      await supabase.rpc('increment_likes', { row_id: postId });
      liked = true;
    }
    const { data: post } = await supabase.from('posts').select('likes_count').eq('id', postId).single();
    return NextResponse.json({ success: true, liked, likes_count: post?.likes_count || 0 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    if (!postId) return NextResponse.json({ success: false, error: 'postId 필요' }, { status: 400 });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let liked = false;
    if (user) {
      const { data } = await supabase.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
      liked = !!data;
    }
    const { data: post } = await supabase.from('posts').select('likes_count').eq('id', postId).single();
    return NextResponse.json({ success: true, liked, likes_count: post?.likes_count || 0 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}
