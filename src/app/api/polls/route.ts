import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// post_polls 실제 스키마: { id, post_id, expires_at }
// question → posts.title / options → poll_options 테이블
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminAny = () => getSupabaseAdmin() as any;

// GET /api/polls?post_id=123
export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  const postId = req.nextUrl.searchParams.get('post_id');
  if (!postId) return NextResponse.json({ poll: null });
  try {
    const admin = adminAny();
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    // post_polls: 실제 컬럼만 (id, post_id, expires_at)
    const { data: poll } = await admin.from('post_polls')
      .select('id, post_id, expires_at')
      .eq('post_id', postId)
      .maybeSingle();
    if (!poll) return NextResponse.json({ poll: null });

    // question은 부모 posts.title에서
    const { data: parentPost } = await admin.from('posts')
      .select('title').eq('id', poll.post_id).maybeSingle();
    const question = parentPost?.title || '';

    // options는 poll_options 테이블에서
    const { data: optRows } = await admin.from('poll_options')
      .select('id, label, sort_order')
      .eq('poll_id', poll.id)
      .order('sort_order', { ascending: true });
    const options: string[] = (optRows || []).map((o: any) => o.label);

    // 투표 집계
    const { data: votes } = await admin.from('post_poll_votes')
      .select('option_index')
      .eq('poll_id', poll.id);
    const counts: number[] = Array(options.length).fill(0);
    (votes ?? []).forEach((v: { option_index: number }) => {
      if (v.option_index >= 0 && v.option_index < counts.length) counts[v.option_index]++;
    });
    const total = counts.reduce((a: number, b: number) => a + b, 0);

    let myVote: number | null = null;
    if (user) {
      const { data: myV } = await admin.from('post_poll_votes')
        .select('option_index').eq('poll_id', poll.id).eq('user_id', user.id).maybeSingle();
      myVote = myV?.option_index ?? null;
    }

    const expired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
    return NextResponse.json({
      poll: { id: poll.id, post_id: poll.post_id, question, options, ends_at: poll.expires_at, counts, total, myVote, expired }
    });
  } catch { return NextResponse.json({ poll: null }); }
}

// POST /api/polls — 투표 생성
export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
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

    const admin = adminAny();
    const { data: post } = await admin.from('posts').select('author_id').eq('id', post_id).single();
    if (post?.author_id !== user.id)
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });

    // 중복 방지
    const { data: existing } = await admin.from('post_polls')
      .select('id').eq('post_id', post_id).maybeSingle();
    if (existing) return NextResponse.json({ error: '이미 투표가 있습니다' }, { status: 409 });

    // posts 제목 업데이트 (question 반영)
    await admin.from('posts').update({ title: question.trim() }).eq('id', post_id);

    // post_polls 생성 — 실제 컬럼: post_id, expires_at
    const expiresAt = ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: poll, error: pollErr } = await admin.from('post_polls').insert({
      post_id,
      expires_at: expiresAt,
    }).select('id').single();
    if (pollErr || !poll) return NextResponse.json({ error: '투표 생성 실패' }, { status: 500 });

    // poll_options 생성
    const optRows = (options as string[]).map((label: string, i: number) => ({
      poll_id: poll.id,
      label: label.trim(),
      sort_order: i,
    }));
    await admin.from('poll_options').insert(optRows);

    return NextResponse.json({
      poll: { id: poll.id, post_id, question: question.trim(), options, ends_at: expiresAt }
    });
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

    const admin = adminAny();
    const { data: poll } = await admin.from('post_polls')
      .select('id, expires_at').eq('id', poll_id).single();
    if (!poll) return NextResponse.json({ error: '투표 없음' }, { status: 404 });
    if (poll.expires_at && new Date(poll.expires_at) < new Date())
      return NextResponse.json({ error: '마감된 투표' }, { status: 400 });

    const { count } = await admin.from('poll_options')
      .select('id', { count: 'exact', head: true }).eq('poll_id', poll_id);
    if (option_index < 0 || option_index >= (count ?? 0))
      return NextResponse.json({ error: '잘못된 선택지' }, { status: 400 });

    await admin.from('post_poll_votes').upsert(
      { poll_id, user_id: user.id, option_index },
      { onConflict: 'poll_id,user_id' }
    );
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
