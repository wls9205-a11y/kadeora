import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeComment } from '@/lib/sanitize'
import { filterContent } from '@/lib/filter'
import { containsBannedWord } from '@/lib/nickname-filter'
import { CommentCreateSchema, parseBody } from '@/lib/validations'
import { containsBlockedUrl } from '@/lib/spam-filter'

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const { data: parsed, error: zodErr } = parseBody(CommentCreateSchema, body);
    if (zodErr) return NextResponse.json({ error: zodErr }, { status: 400 });
    const content = sanitizeComment(parsed!.content);
    const postId = parsed!.post_id;
    if (!content || content.length < 1) return NextResponse.json({ error: '댓글 내용을 입력해주세요.' }, { status: 400 });
    if (containsBannedWord(content)) return NextResponse.json({ error: '부적절한 표현이 포함되어 있습니다.' }, { status: 400 });
    if (containsBlockedUrl(content)) return NextResponse.json({ error: '허용되지 않는 링크가 포함되어 있습니다. (카카오 오픈채팅, 텔레그램 등 외부 메신저 링크는 게시할 수 없습니다)' }, { status: 400 });
    const { isBlocked, reason } = filterContent(content);
    if (isBlocked) return NextResponse.json({ error: reason ?? '내용을 다시 확인해주세요' }, { status: 400 });

    // 댓글 INSERT (유저 세션 — 본인 데이터)
    const imageUrl = typeof body.image_url === 'string' && body.image_url.startsWith('http') ? body.image_url : null;
    const { data, error } = await (supabase as any).from('comments').insert({
      content, post_id: postId, author_id: user.id,
      ...(parsed!.parent_id ? { parent_id: parsed!.parent_id } : {}),
      ...(imageUrl ? { image_url: imageUrl } : {}),
    }).select('id, content, created_at, author_id, parent_id, image_url').single();
    if (error) { console.error('[Comments]', error.message); return NextResponse.json({ error: '댓글 작성에 실패했습니다.' }, { status: 500 }); }

    // 알림은 DB 트리거(notify_on_comment)가 자동 처리 — 수동 INSERT 불필요
    // 웹 푸시 발송 (글 작성자에게 실시간 알림)
    try {
      const admin = getSupabaseAdmin();
      const { data: post } = await admin.from('posts').select('author_id, title').eq('id', postId).single();
      const { sendPushToUsers } = await import('@/lib/push-utils');
      const { data: myProfile } = await admin.from('profiles').select('nickname').eq('id', user.id).single();
      const myName = myProfile?.nickname || '누군가';

      // 글 작성자에게 알림
      if (post?.author_id && post.author_id !== user.id) {
        sendPushToUsers([post.author_id], {
          title: `💬 ${myName}님이 댓글을 남겼어요`,
          body: content.slice(0, 60),
          url: `/feed/${postId}`,
          tag: `comment-${postId}-${Date.now()}`,
        }).catch(() => {});
      }

      // 대댓글이면 원댓글 작성자에게도 알림
      if (parsed!.parent_id) {
        const { data: parentComment } = await (admin as any).from('comments')
          .select('author_id').eq('id', parsed!.parent_id).single();
        if (parentComment?.author_id && parentComment.author_id !== user.id && parentComment.author_id !== post?.author_id) {
          sendPushToUsers([parentComment.author_id], {
            title: `↩️ ${myName}님이 답글을 남겼어요`,
            body: content.slice(0, 60),
            url: `/feed/${postId}`,
            tag: `reply-${parsed!.parent_id}-${Date.now()}`,
          }).catch(() => {});
        }
      }
    } catch {}

    // 포인트 적립 (award_points RPC — 트리거 바이패스)
    try {
      const admin = getSupabaseAdmin();
      await admin.rpc('award_points', { p_user_id: user.id, p_amount: 5, p_reason: '댓글작성', p_meta: null });
      // 첫 댓글 보너스 (+20P)
      const { count } = await (admin as any).from('comments').select('id', { count: 'exact', head: true }).eq('author_id', user.id);
      if (count === 1) {
        await admin.rpc('award_points', { p_user_id: user.id, p_amount: 20, p_reason: '첫댓글보너스', p_meta: null });
      }
    } catch {}

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) { console.error('[Comments]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
