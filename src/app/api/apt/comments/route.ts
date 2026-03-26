import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const houseKey = req.nextUrl.searchParams.get('house_key');
    if (!houseKey) return NextResponse.json({ comments: [] });
    const sb = await createSupabaseServer();
    const { data, error } = await sb.from('apt_comments')
      .select('id, content, created_at, author_id, profiles!apt_comments_author_id_fkey(nickname)')
      .eq('house_key', houseKey).order('created_at', { ascending: false }).limit(50);
    if (error) return NextResponse.json({ comments: [] });
    return NextResponse.json({ comments: (data || []).map((c: any) => ({ id: c.id, content: c.content, nickname: c.profiles?.nickname ?? '익명', created_at: c.created_at })) }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=150' },
    });
  } catch { return NextResponse.json({ comments: [] }); }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
    const { house_key, house_nm, house_type, content } = await req.json();
    if (!content || content.length > 200) return NextResponse.json({ error: '200자 이내' }, { status: 400 });
    const { data, error } = await sb.from('apt_comments').insert({ house_key, house_nm, house_type, author_id: user.id, content }).select('id, content, created_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 503 });
    const { data: profile } = await sb.from('profiles').select('nickname').eq('id', user.id).single();
    return NextResponse.json({ comment: { ...data, nickname: profile?.nickname ?? '익명' } }, { status: 201 });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
