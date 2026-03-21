import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const topicId = parseInt(id, 10);
    if (!topicId) return NextResponse.json({ error: 'Invalid topic' }, { status: 400 });

    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { vote } = await req.json();
    if (vote !== 'a' && vote !== 'b') return NextResponse.json({ error: 'Invalid vote' }, { status: 400 });

    // Check existing vote
    const { data: existing } = await sb.from('discussion_votes')
      .select('id, vote').eq('topic_id', topicId).eq('author_id', user.id).maybeSingle();

    if (existing) {
      if (existing.vote === vote) return NextResponse.json({ error: '이미 투표했습니다.' }, { status: 409 });
      // Change vote
      await sb.from('discussion_votes').update({ vote }).eq('id', existing.id);
      const inc = vote === 'a' ? { vote_a: 1, vote_b: -1 } : { vote_a: -1, vote_b: 1 };
      const { data: topic } = await sb.from('discussion_topics').select('vote_a, vote_b').eq('id', topicId).single();
      if (topic) {
        await sb.from('discussion_topics').update({
          vote_a: Math.max(0, (topic.vote_a || 0) + inc.vote_a),
          vote_b: Math.max(0, (topic.vote_b || 0) + inc.vote_b),
        }).eq('id', topicId);
      }
      return NextResponse.json({ voted: vote, changed: true });
    }

    // New vote
    const { error } = await sb.from('discussion_votes').insert({ topic_id: topicId, author_id: user.id, vote });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const col = vote === 'a' ? 'vote_a' : 'vote_b';
    const { data: topic } = await sb.from('discussion_topics').select(col).eq('id', topicId).single();
    if (topic) {
      await sb.from('discussion_topics').update({ [col]: ((topic as any)[col] || 0) + 1 }).eq('id', topicId);
    }

    return NextResponse.json({ voted: vote }, { status: 201 });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
