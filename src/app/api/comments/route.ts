import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeComment } from '@/lib/sanitize'
import { filterContent } from '@/lib/filter'
import { containsBannedWord } from '@/lib/nickname-filter'

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const content = sanitizeComment(body.content);
    const postId = body.post_id;
    if (!content || content.length < 1) return NextResponse.json({ error: '댓글 내용을 입력해주세요.' }, { status: 400 });
    if (containsBannedWord(content)) return NextResponse.json({ error: '부적절한 표현이 포함되어 있습니다.' }, { status: 400 });
    const { isBlocked, reason } = filterContent(content);
    if (isBlocked) return NextResponse.json({ error: reason ?? '내용을 다시 확인해주세요' }, { status: 400 });
    if (!postId) return NextResponse.json({ error: '게시글 ID가 필요합니다.' }, { status: 400 });

    // 댓글 INSERT (유저 세션 — 본인 데이터)
    const { data, error } = await supabase.from('comments').insert({ content, post_id: postId, author_id: user.id }).select('*').single();
    if (error) { console.error('[Comments]', error.message); return NextResponse.json({ error: '댓글 작성에 실패했습니다.' }, { status: 500 }); }

    // 알림 INSERT (service_role — 타인 데이터)
    try {
      const { data: post } = await getSupabaseAdmin().from('posts').select('author_id').eq('id', postId).single();
      if (post?.author_id && post.author_id !== user.id) {
        const { data: profile } = await getSupabaseAdmin().from('profiles').select('nickname').eq('id', user.id).single();
        const preview = content.length > 30 ? content.slice(0, 30) + '...' : content;
        await getSupabaseAdmin().from('notifications').insert({
          user_id: post.author_id, type: 'comment',
          content: `${profile?.nickname ?? '누군가'}님이 댓글을 달았어요: ${preview}`,
        });
      }
    } catch {}

    // 포인트 적립 (award_points RPC — 트리거 바이패스)
    try {
      await getSupabaseAdmin().rpc('award_points', { p_user_id: user.id, p_amount: 5, p_reason: '댓글작성', p_meta: null });
    } catch {}

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) { console.error('[Comments]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
