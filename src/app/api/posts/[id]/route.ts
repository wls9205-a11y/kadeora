import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase-server';
import { z } from 'zod';

const PatchSchema = z.object({
  category: z.enum(['apt', 'stock', 'free']),
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const postId = Number(id);
    if (isNaN(postId)) return NextResponse.json({ error: '잘못된 게시글 ID입니다' }, { status: 400 });

    const sb = await createSupabaseServer();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: '입력값이 올바르지 않습니다', details: parsed.error.flatten() }, { status: 422 });

    // Verify ownership
    const { data: post } = await sb.from('posts').select('author_id').eq('id', postId).single();
    if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 });
    if (post.author_id !== session.user.id) return NextResponse.json({ error: '수정 권한이 없습니다' }, { status: 403 });

    const { data: updated, error } = await sb
      .from('posts')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    try { revalidatePath('/feed'); revalidatePath(`/feed/${id}`); } catch {}
    return NextResponse.json({ post: updated });
  } catch (e: unknown) {
    console.error('[PATCH /api/posts/:id]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const postId = Number(id);
    if (isNaN(postId)) return NextResponse.json({ error: '잘못된 게시글 ID입니다' }, { status: 400 });

    const sb = await createSupabaseServer();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    // Verify ownership
    const { data: post } = await sb.from('posts').select('author_id').eq('id', postId).single();
    if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 });
    if (post.author_id !== session.user.id) return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 });

    // Soft delete
    const { error } = await sb
      .from('posts')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', postId);

    if (error) throw error;
    try { revalidatePath('/feed'); revalidatePath(`/feed/${id}`); } catch {}
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('[DELETE /api/posts/:id]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
