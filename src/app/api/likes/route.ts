import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    // 인증: 유저 세션으로 user 확인
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[Likes] Auth failed:', authError?.message);
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const postId = Number(body.post_id); if (!postId || isNaN(postId)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    if (!postId) return NextResponse.json({ error: '게시글 ID가 필요합니다.' }, { status: 400 });

    // DB 작업: service_role로 RLS 우회 (유저 검증은 위에서 완료)
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin.from('post_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await admin.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      if (error) { console.error('[Likes DELETE]', error.message); return NextResponse.json({ error: '좋아요 취소 실패' }, { status: 500 }); }

      // likes_count 동기화 (DB 트리거 handle_post_like_delete가 처리하지만 service_role에서는 트리거가 다를 수 있으므로 수동 동기화)
      const { count } = await admin.from('post_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', postId);
      await admin.from('posts').update({ likes_count: count ?? 0 }).eq('id', postId);

      return NextResponse.json({ liked: false });
    } else {
      const { error } = await admin.from('post_likes').insert({ post_id: postId, user_id: user.id });
      if (error) { console.error('[Likes INSERT]', error.message); return NextResponse.json({ error: '좋아요 실패' }, { status: 500 }); }

      // likes_count 동기화
      const { count } = await admin.from('post_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', postId);
      await admin.from('posts').update({ likes_count: count ?? 0 }).eq('id', postId);

      // 알림은 DB 트리거(handle_post_like_insert)가 자동 처리
      // service_role에서는 트리거가 실행되므로 알림도 자동 생성됨

      return NextResponse.json({ liked: true });
    }
  } catch (err) {
    console.error('[Likes]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
