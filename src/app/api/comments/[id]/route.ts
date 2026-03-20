import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: '댓글 ID가 필요합니다' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: comment, error: fetchError } = await admin
      .from('comments').select('id, author_id, post_id')
      .eq('id', id).eq('is_deleted', false).single();

    if (fetchError || !comment) return NextResponse.json({ error: '댓글을 찾을 수 없습니다' }, { status: 404 });
    if (comment.author_id !== user.id) return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 });

    // Soft delete
    await admin.from('comments').update({ is_deleted: true }).eq('id', id);

    // comments_count 동기화 — race condition 방지를 위해 실제 카운트 조회
    const { count } = await admin.from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', comment.post_id)
      .eq('is_deleted', false);
    await admin.from('posts').update({ comments_count: count ?? 0 }).eq('id', comment.post_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/comments/:id]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
