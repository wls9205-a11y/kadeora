import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: 북마크 여부 확인 (단일 postId 또는 배치 postIds)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ bookmarked: false, bookmarkedIds: [] });

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const postIds = searchParams.get('postIds');

    // 배치 모드: ?postIds=1,2,3
    if (postIds) {
      const ids = postIds.split(',').map(Number).filter(n => !isNaN(n));
      if (ids.length === 0) return NextResponse.json({ bookmarkedIds: [] });
      const { data } = await getSupabaseAdmin().from('bookmarks')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', ids);
      return NextResponse.json({ bookmarkedIds: (data ?? []).map(d => d.post_id) });
    }

    // 단일 모드: ?postId=123
    if (!postId) return NextResponse.json({ bookmarked: false });
    const { data } = await getSupabaseAdmin().from('bookmarks')
      .select('post_id')
      .eq('post_id', Number(postId))
      .eq('user_id', user.id)
      .maybeSingle();
    return NextResponse.json({ bookmarked: !!data });
  } catch {
    return NextResponse.json({ bookmarked: false, bookmarkedIds: [] });
  }
}

// POST: 북마크 토글
export async function POST(request: NextRequest) {
  if (!(await rateLimit(request, 'api'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const body = await request.json(); const postId = Number(body.postId); if (!postId || isNaN(postId)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    if (!postId) return NextResponse.json({ error: 'postId 필요' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin.from('bookmarks')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await admin.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
      return NextResponse.json({ bookmarked: false });
    } else {
      await admin.from('bookmarks').insert({ post_id: postId, user_id: user.id });
      return NextResponse.json({ bookmarked: true });
    }
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
