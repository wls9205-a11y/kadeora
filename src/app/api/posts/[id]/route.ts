import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { containsBlockedUrl } from '@/lib/spam-filter';
import { z } from 'zod';

const PatchSchema = z.object({
  category: z.enum(['apt', 'stock', 'free', 'local']),
  title: z.string().min(1).max(150),
  content: z.string().min(1).max(5000),
  images: z.array(z.string().url()).max(5).optional(),
  tags: z.array(z.string().max(30)).max(5).optional(),
  is_anonymous: z.boolean().optional(),
  region_id: z.string().max(50).optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { id } = await params;
    const postId = Number(id);
    if (isNaN(postId)) return NextResponse.json({ error: '잘못된 게시글 ID입니다' }, { status: 400 });

    const sb = await createSupabaseServer();
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: '입력값이 올바르지 않습니다', details: parsed.error.flatten() }, { status: 422 });

    // 스팸 URL 차단
    if (containsBlockedUrl(parsed.data.title) || containsBlockedUrl(parsed.data.content)) {
      return NextResponse.json({ error: '허용되지 않는 링크가 포함되어 있습니다. (카카오 오픈채팅, 텔레그램 등 외부 메신저 링크는 게시할 수 없습니다)' }, { status: 400 });
    }

    // Verify ownership
    const { data: post } = await sb.from('posts').select('author_id').eq('id', postId).single();
    if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 });
    if (post.author_id !== user.id) return NextResponse.json({ error: '수정 권한이 없습니다' }, { status: 403 });

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

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { id } = await params;
    const postId = Number(id);
    if (isNaN(postId)) return NextResponse.json({ error: '잘못된 게시글 ID입니다' }, { status: 400 });

    const sb = await createSupabaseServer();
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    // 관리자 여부 확인
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
    const isAdmin = profile?.is_admin === true;

    // Verify ownership or admin
    const { data: post } = await sb.from('posts').select('author_id, title').eq('id', postId).single();
    if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 });
    if (post.author_id !== user.id && !isAdmin) return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 });

    // 관리자 삭제 시 사유 파싱
    let adminReason = '';
    try {
      const body = await req.json();
      adminReason = body?.reason || '';
    } catch { /* body 없으면 무시 */ }

    // Soft delete
    const { error } = await admin
      .from('posts')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', postId);

    if (error) throw error;

    // 관리자 삭제 로깅
    if (isAdmin && post.author_id !== user.id) {
      try {
        await (admin as any).from('admin_logs').insert({
          admin_id: user.id,
          action: 'delete_post',
          target_type: 'post',
          target_id: String(postId),
          details: { title: post.title, author_id: post.author_id, reason: adminReason || '관리자 삭제' },
        });
      } catch { /* 로그 실패 무시 */ }
    }

    try { revalidatePath('/feed'); revalidatePath(`/feed/${id}`); } catch {}
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('[DELETE /api/posts/:id]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
