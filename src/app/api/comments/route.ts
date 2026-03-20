import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
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
    if (isBlocked) {
      return NextResponse.json({ error: reason ?? '내용을 다시 확인해주세요' }, { status: 400 });
    }
    if (!postId) return NextResponse.json({ error: '게시글 ID가 필요합니다.' }, { status: 400 });
    const { data, error } = await supabase.from('comments').insert({ content, post_id: postId, author_id: user.id }).select('*').single();
    if (error) { console.error('[Comments POST]', error.message, error.details); return NextResponse.json({ error: '댓글 작성에 실패했습니다: ' + error.message }, { status: 500 }); }

    // 댓글 알림 (service_role로 다른 유저 알림 INSERT)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const adminSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: post } = await adminSb.from('posts').select('author_id').eq('id', postId).single();
      if (post?.author_id && post.author_id !== user.id) {
        const { data: profile } = await adminSb.from('profiles').select('nickname').eq('id', user.id).single();
        const preview = content.length > 30 ? content.slice(0, 30) + '...' : content;
        await adminSb.from('notifications').insert({
          user_id: post.author_id, type: 'comment',
          content: `${profile?.nickname ?? '누군가'}님이 댓글을 달았어요: ${preview}`,
        });
      }
    } catch {}

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const adminSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: cp } = await adminSb.from('profiles').select('points').eq('id', user.id).single();
      await adminSb.from('profiles').update({ points: (cp?.points ?? 0) + 5 }).eq('id', user.id);
    } catch {}

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) { console.error('[Comments POST]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
