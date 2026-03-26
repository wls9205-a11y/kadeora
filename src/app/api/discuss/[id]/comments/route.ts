import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb = await createSupabaseServer();
    const { data, error } = await sb.from('discussion_comments')
      .select('*, profiles!discussion_comments_author_id_fkey(nickname, grade)')
      .eq('topic_id', parseInt(id, 10))
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comments: data || [] }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=150' },
    });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { id } = await params;
    const topicId = parseInt(id, 10);
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { content } = await req.json();
    const trimmed = (content || '').trim();
    if (!trimmed || trimmed.length < 2) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    if (trimmed.length > 500) return NextResponse.json({ error: '500자 이하로 작성해주세요.' }, { status: 400 });

    const { data, error } = await sb.from('discussion_comments')
      .insert({ topic_id: topicId, author_id: user.id, content: trimmed })
      .select('*, profiles!discussion_comments_author_id_fkey(nickname, grade)')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Increment comment_count
    const { data: topic } = await sb.from('discussion_topics').select('comment_count').eq('id', topicId).single();
    if (topic) await sb.from('discussion_topics').update({ comment_count: (topic.comment_count || 0) + 1 }).eq('id', topicId);

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
