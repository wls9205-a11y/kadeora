import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { z } from 'zod';

const PostSchema = z.object({
  category: z.enum(['apt', 'stock', 'free']),
  title: z.string().min(1, '제목을 입력해주세요').max(100, '제목은 100자 이내'),
  content: z.string().min(1, '내용을 입력해주세요').max(5000, '내용은 5000자 이내'),
});

export async function POST(req: Request) {
  try {
    const sb = await createSupabaseServer();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? '입력값 오류';
      return NextResponse.json({ error: firstError }, { status: 422 });
    }

    const { data: post, error } = await sb
      .from('posts')
      .insert({ ...parsed.data, author_id: session.user.id, view_count: 0, likes_count: 0, comments_count: 0 })
      .select()
      .single();

    if (error) throw error;

    // Update profile post_count
    await sb.rpc('increment_post_count', { uid: session.user.id }).catch(() => {});

    return NextResponse.json({ post }, { status: 201 });
  } catch (e: unknown) {
    console.error('[POST /api/posts]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sb = await createSupabaseServer();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const { post_id } = body;
    if (!post_id) return NextResponse.json({ error: 'post_id 필요' }, { status: 400 });

    const { data: post } = await sb.from('posts').select('user_id').eq('id', post_id).single();
    if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 });
    if (post.author_id !== session.user.id) return NextResponse.json({ error: '삭제 권한 없음' }, { status: 403 });

    const { error } = await sb.from('posts').update({ is_deleted: true }).eq('id', post_id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('[DELETE /api/posts]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
