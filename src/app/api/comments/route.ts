import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { z } from 'zod';

const CommentSchema = z.object({
  post_id: z.number().int().positive(),
  content: z.string().min(1, '내용을 입력해주세요').max(500, '500자 이내로 작성해주세요'),
});

export async function POST(req: Request) {
  try {
    const sb = await createSupabaseServer();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const parsed = CommentSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? '입력값 오류';
      return NextResponse.json({ error: firstError }, { status: 422 });
    }

    // Verify post exists
    const { data: post } = await sb.from('posts').select('id, comments_count').eq('id', parsed.data.post_id).eq('is_deleted', false).single();
    if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 });

    const { data: comment, error } = await sb
      .from('comments')
      .insert({ post_id: parsed.data.post_id, author_id: session.user.id, content: parsed.data.content })
      .select()
      .single();

    if (error) throw error;

    // Sync comments_count
    await sb.from('posts').update({ comments_count: (post.comments_count ?? 0) + 1 }).eq('id', parsed.data.post_id);

    // Get nickname for response
    const { data: profile } = await sb.from('profiles').select('nickname').eq('id', session.user.id).single();

    return NextResponse.json({ comment: { ...comment, nickname: profile?.nickname }, success: true }, { status: 201 });
  } catch (e: unknown) {
    console.error('[POST /api/comments]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
