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

    // 좋아요 토글 (유저 세션 — 본인 데이터)
    const { data: existing } = await supabase.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      if (error) { console.error('[Likes]', error); return NextResponse.json({ error: '좋아요 취소 실패' }, { status: 500 }); }
      return NextResponse.json({ liked: false });
    } else {
      const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      if (error) { console.error('[Likes]', error); return NextResponse.json({ error: '좋아요 실패' }, { status: 500 }); }

      // 알림 + likes_count는 DB 트리거(handle_post_like_insert)가 자동 처리

      return NextResponse.json({ liked: true });
    }
  } catch (err) { console.error('[Likes]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
