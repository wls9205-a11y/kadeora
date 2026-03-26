import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await params;
    const sb = await createSupabaseServer();
    const { data } = await sb.from('stock_comments')
      .select('*, profiles!stock_comments_author_id_fkey(nickname, grade)')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ comments: data || [] }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=150' },
    });
  } catch { return NextResponse.json({ comments: [] }); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { symbol } = await params;
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { content } = await req.json();
    const trimmed = (content || '').trim();
    if (!trimmed || trimmed.length < 2) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    if (trimmed.length > 300) return NextResponse.json({ error: '300자 이하로 작성해주세요.' }, { status: 400 });

    const { data, error } = await sb.from('stock_comments')
      .insert({ symbol, author_id: user.id, content: trimmed })
      .select('*, profiles!stock_comments_author_id_fkey(nickname, grade)')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
