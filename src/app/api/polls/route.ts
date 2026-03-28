import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/polls?post_id=123 — 투표 현황 조회
export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  const postId = req.nextUrl.searchParams.get('post_id');
  if (!postId) return NextResponse.json({ poll: null });
  try {
    const admin = getSupabaseAdmin();
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: poll } = await admin.from('post_polls')
      .select('id, question, options, ends_at')
      .eq('post_id', postId)
      .maybeSingle();
    if (!poll) return NextResponse.json({ poll: null });

    // 옵션별 득표수
    const { data: votes } = await admin.from('post_poll_votes')
      .select('option_index')
      .eq('poll_id', poll.id);
    const counts: number[] = Array((poll.options as string[]).length).fill(0);
    (votes ?? []).forEach((v: { option_index: number }) => { counts[v.option_index]++; });
    const total = counts.reduce((a, b) => a + b, 0);

    // 내 투표
    let myVote: number | null = null;
    if (user) {
      const { data: myV } = await admin.from('post_poll_votes')
        .select('option_index').eq('poll_id', poll.id).eq('user_id', user.id).maybeSingle();
      myVote = myV?.option_index ?? null;
    }

    const expired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
    return NextResponse.json({ poll: { ...poll, counts, total, myVote, expired } });
  } catch { return NextResponse.json({ poll: null }); }
}

// POST /api/polls — 투표 생성 (글쓴이만)
export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'write'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const body = await req.json();
    const { post_id, question, options, ends_at } = body;
    if (!post_id || !question?.trim() || !options || options.length < 2)
      return NextResponse.json({ error: '질문과 선택지 2개 이상 필요' }, { status: 400 });
    if (options.length > 6)
      return NextResponse.json({ error: '선택지는 최대 6개' }, { status: 400 });

    const admin = getSupabaseAdmin();
    // 글쓴이 확인
    const { data: post } = await admin.from('posts').select('author_id').eq('id', post_id).single();
    if (post?.author_id !== user.id)
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });

    const { data, error } = await admin.from('post_polls').insert({
      post_id, question: question.trim(),
      options: options.map((o: string) => o.trim()).filter(Boolean),
      ends_at: ends_at || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ poll: data });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}

// PATCH /api/polls — 투표 참여
export async function PATCH(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { poll_id, option_index } = await req.json();
    if (poll_id == null || option_index == null)
      return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });

    const admin = getSupabaseAdmin();
    // 마감 확인
    const { data: poll } = await admin.from('post_polls').select('ends_at, options').eq('id', poll_id).single();
    if (!poll) return NextResponse.json({ error: '투표 없음' }, { status: 404 });
    if (poll.ends_at && new Date(poll.ends_at) < new Date())
      return NextResponse.json({ error: '마감된 투표' }, { status: 400 });
    if (option_index < 0 || option_index >= (poll.options as string[]).length)
      return NextResponse.json({ error: '잘못된 선택지' }, { status: 400 });

    // upsert (이미 투표했으면 변경)
    await admin.from('post_poll_votes').upsert(
      { poll_id, user_id: user.id, option_index },
      { onConflict: 'poll_id,user_id' }
    );
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
