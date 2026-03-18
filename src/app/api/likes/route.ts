import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'


export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const postId = body.post_id;
    if (!postId) return NextResponse.json({ error: '게시글 ID가 필요합니다.' }, { status: 400 });
    const { data: existing } = await supabase.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      if (error) { console.error('[Likes DEL]', error); return NextResponse.json({ error: '좋아요 취소 실패' }, { status: 500 }); }
      return NextResponse.json({ liked: false });
    } else {
      const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      if (error) { console.error('[Likes INS]', error); return NextResponse.json({ error: '좋아요 실패' }, { status: 500 }); }

      // 좋아요 알림 (중복 방지: 오늘 같은 글 같은 유저 알림 있으면 skip)
      try {
        const { data: post } = await supabase.from('posts').select('author_id').eq('id', postId).single();
        if (post?.author_id && post.author_id !== user.id) {
          const today = new Date().toISOString().split('T')[0];
          const { count } = await supabase.from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', post.author_id).eq('type', 'like')
            .like('content', `%${user.id.slice(0, 8)}%`)
            .gte('created_at', today);
          if (!count || count === 0) {
            const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
            await supabase.from('notifications').insert({
              user_id: post.author_id, type: 'like',
              content: `${profile?.nickname ?? '누군가'}님이 좋아요를 눌렀어요 ❤`,
            });
          }
        }
      } catch {}

      return NextResponse.json({ liked: true });
    }
  } catch (err) { console.error('[Likes]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
