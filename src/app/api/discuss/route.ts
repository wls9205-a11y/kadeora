import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = 20;

    let query = sb.from('discussion_topics')
      .select('*, profiles!discussion_topics_author_id_fkey(nickname)', { count: 'exact' })
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category && category !== 'all') query = query.eq('category', category);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ topics: data || [], total: count || 0, page });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const body = await req.json();
    const title = (body.title || '').trim();
    if (!title || title.length < 5) return NextResponse.json({ error: '주제는 5자 이상이어야 합니다.' }, { status: 400 });
    if (title.length > 100) return NextResponse.json({ error: '주제는 100자 이하여야 합니다.' }, { status: 400 });

    const { data, error } = await sb.from('discussion_topics').insert({
      title,
      description: (body.description || '').trim().slice(0, 500) || null,
      category: ['stock', 'apt', 'economy', 'free'].includes(body.category) ? body.category : 'free',
      topic_type: body.topic_type === 'open' ? 'open' : 'poll',
      option_a: (body.option_a || '찬성').trim().slice(0, 20),
      option_b: (body.option_b || '반대').trim().slice(0, 20),
      author_id: user.id,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ topic: data }, { status: 201 });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
