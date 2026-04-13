import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// POST /api/feed/poll — 투표 생성
export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { question, options, category = 'free', region_id = '', expires_hours = 24 } = await req.json();

    if (!question?.trim() || !options?.length || options.length < 2) {
      return NextResponse.json({ error: '질문과 최소 2개 선택지 필요' }, { status: 400 });
    }

    // 1. posts 테이블에 글 생성
    const { data: post, error: postErr } = await sb.from('posts').insert({
      title: question.trim(),
      content: question.trim(),
      excerpt: question.trim().slice(0, 100),
      category,
      region_id,
      author_id: user.id,
      post_type: 'poll',
    }).select('id').single();

    if (postErr || !post) return NextResponse.json({ error: postErr?.message || '글 생성 실패' }, { status: 500 });

    // 2. post_polls 생성
    const expiresAt = new Date(Date.now() + expires_hours * 60 * 60 * 1000).toISOString();
    const { data: poll, error: pollErr } = await (sb as any).from('post_polls').insert({
      post_id: post.id,
      expires_at: expiresAt,
    }).select('id').single();

    if (pollErr || !poll) return NextResponse.json({ error: '투표 생성 실패' }, { status: 500 });

    // 3. poll_options 생성
    const optRows = options.map((label: string, i: number) => ({
      poll_id: poll.id,
      label: label.trim(),
      sort_order: i,
    }));
    await (sb as any).from('poll_options').insert(optRows);

    // 4. 포인트 지급
    await (sb as any).rpc('award_points', {
      p_user_id: user.id,
      p_amount: 10,
      p_reason: '투표생성',
      p_meta: { ref_id: post.id },
    });

    return NextResponse.json({ success: true, post_id: post.id, poll_id: poll.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
