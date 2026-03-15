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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: '댓글 ID 필요' }, { status: 400 });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: comment, error: fetchError } = await supabase.from('comments').select('id, author_id, post_id').eq('id', id).eq('is_deleted', false).single();
    if (fetchError || !comment) return NextResponse.json({ success: false, error: '댓글 없음' }, { status: 404 });
    if (comment.author_id !== user.id) return NextResponse.json({ success: false, error: '본인만 삭제 가능' }, { status: 403 });
    await supabase.from('comments').update({ is_deleted: true }).eq('id', id);
    const { data: post } = await supabase.from('posts').select('comments_count').eq('id', comment.post_id).single();
    if (post && post.comments_count > 0) {
      await supabase.from('posts').update({ comments_count: post.comments_count - 1 }).eq('id', comment.post_id);
    }
    return NextResponse.json({ success: true, message: '댓글 삭제 완료' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}
