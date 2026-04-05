import { NextRequest, NextResponse } from 'next/server';
import { sanitizeText } from '@/lib/sanitize';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';

const SCAM_KEYWORDS = ['확정수익', '원금보장', '100% 수익', '리딩방 초대', '수익인증'];

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { postId, commentId, messageId, reason, details } = await req.json();

    if (!reason) {
      return NextResponse.json({ error: '신고 사유를 선택해주세요' }, { status: 400 });
    }

    // Determine content_type
    let content_type: 'post' | 'comment' | 'message';
    if (postId) content_type = 'post';
    else if (commentId) content_type = 'comment';
    else if (messageId) content_type = 'message';
    else {
      return NextResponse.json({ error: '신고 대상이 지정되지 않았습니다' }, { status: 400 });
    }

    // Check duplicate
    let dupQuery = supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', user.id);

    if (postId) dupQuery = dupQuery.eq('post_id', postId);
    if (commentId) dupQuery = dupQuery.eq('comment_id', commentId);
    if (messageId) dupQuery = dupQuery.eq('message_id', messageId);

    const { count: dupCount } = await dupQuery;
    if (dupCount && dupCount > 0) {
      return NextResponse.json({ error: '이미 신고한 콘텐츠입니다' }, { status: 409 });
    }

    // Insert report
    const { error: insertErr } = await supabase.from('reports').insert({
      reporter_id: user.id,
      post_id: postId ?? null,
      comment_id: commentId ?? null,
      message_id: messageId ?? null,
      reason,
      details: details ?? null,
      status: 'pending',
      content_type,
      auto_hidden: false,
    });

    if (insertErr) {
      return NextResponse.json({ error: '신고 접수에 실패했습니다' }, { status: 500 });
    }

    // Post-specific logic
    if (content_type === 'post' && postId) {
      // Check scam keywords in post content
      const { data: postData } = await supabase
        .from('posts')
        .select('title, content')
        .eq('id', postId)
        .maybeSingle();

      if (postData) {
        const text = `${postData.title ?? ''} ${postData.content ?? ''}`;
        const hasScam = SCAM_KEYWORDS.some(kw => text.includes(kw));

        if (hasScam) {
          // Immediately hide post and mark report as auto_hidden
          await supabase.from('posts').update({ is_deleted: true }).eq('id', postId);
          await supabase
            .from('reports')
            .update({ auto_hidden: true })
            .eq('reporter_id', user.id)
            .eq('post_id', postId);
        }
      }

      // Count total reports for this post; if >= 5, hide post
      const { count: reportCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId);

      if (reportCount && reportCount >= 5) {
        await supabase.from('posts').update({ is_deleted: true }).eq('id', postId);
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
