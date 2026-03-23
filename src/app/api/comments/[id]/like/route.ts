import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const { id } = await params;
    const commentId = parseInt(id);
    if (isNaN(commentId)) return NextResponse.json({ error: '잘못된 댓글 ID' }, { status: 400 });

    const admin = getSupabaseAdmin();

    // 댓글 존재 확인
    const { data: comment } = await admin.from('comments')
      .select('id, likes_count')
      .eq('id', commentId)
      .eq('is_deleted', false)
      .single();

    if (!comment) return NextResponse.json({ error: '댓글을 찾을 수 없습니다' }, { status: 404 });

    // 중복 좋아요 방지 (comment_likes 테이블 있으면 사용, 없으면 단순 증가)
    try {
      const { data: existing } = await admin.from('comment_likes')
        .select('comment_id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // 이미 좋아요 → 취소
        await admin.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
        await admin.from('comments').update({
          likes_count: Math.max(0, (comment.likes_count ?? 0) - 1),
        }).eq('id', commentId);
        return NextResponse.json({ liked: false, likes_count: Math.max(0, (comment.likes_count ?? 0) - 1) });
      }

      // 좋아요
      await admin.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
      await admin.from('comments').update({
        likes_count: (comment.likes_count ?? 0) + 1,
      }).eq('id', commentId);
      return NextResponse.json({ liked: true, likes_count: (comment.likes_count ?? 0) + 1 });
    } catch {
      // comment_likes 테이블이 없는 경우 → 단순 증가
      await admin.from('comments').update({
        likes_count: (comment.likes_count ?? 0) + 1,
      }).eq('id', commentId);
      return NextResponse.json({ liked: true, likes_count: (comment.likes_count ?? 0) + 1 });
    }
  } catch (err) {
    console.error('[Comment Like]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
