import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const houseKey = req.nextUrl.searchParams.get('house_key');
    if (!houseKey) return NextResponse.json({ comments: [] });
    const sb = await createSupabaseServer();
    const { data, error } = await (sb as any).from('apt_comments')
      .select('id, content, created_at, author_id, image_url, profiles!apt_comments_author_id_fkey(nickname)')
      .eq('house_key', houseKey).order('created_at', { ascending: false }).limit(50);
    if (error) return NextResponse.json({ comments: [] });
    return NextResponse.json({ comments: (data || []).map((c: any) => ({ id: c.id, content: c.content, nickname: c.profiles?.nickname ?? '익명', created_at: c.created_at, image_url: c.image_url || null })) }, {
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
    const body = await req.json();
    const { house_key, house_nm, house_type, content } = body;
    const imageUrl = typeof body.image_url === 'string' && body.image_url.startsWith('http') ? body.image_url : null;
    if ((!content || content.length === 0) && !imageUrl) return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 });
    if (content && content.length > 200) return NextResponse.json({ error: '200자 이내' }, { status: 400 });
    const { data, error } = await (sb as any).from('apt_comments').insert({
      house_key, house_nm, house_type, author_id: user.id, content: content || '(사진)',
      ...(imageUrl ? { image_url: imageUrl } : {}),
    }).select('id, content, created_at, image_url').single();
    if (error) return NextResponse.json({ error: '서비스 일시 오류입니다' }, { status: 503 });
    const { data: profile } = await sb.from('profiles').select('nickname').eq('id', user.id).single();
    try { await getSupabaseAdmin().rpc('award_points', { p_user_id: user.id, p_amount: 5, p_reason: '댓글작성', p_meta: null }); } catch {}
    return NextResponse.json({ comment: { ...data, nickname: profile?.nickname ?? '익명' } }, { status: 201 });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
