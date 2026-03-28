import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ bookmarks: [], isBookmarked: false });

  const blogPostId = req.nextUrl.searchParams.get('blogPostId');

  if (blogPostId) {
    // Single check
    const { data } = await sb.from('blog_bookmarks')
      .select('id')
      .eq('blog_post_id', Number(blogPostId))
      .eq('user_id', user.id)
      .maybeSingle();
    return NextResponse.json({ isBookmarked: !!data });
  }

  // List all bookmarks
  const { data: bm } = await sb.from('blog_bookmarks')
    .select('blog_post_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!bm || bm.length === 0) return NextResponse.json({ bookmarks: [] });

  const admin = getSupabaseAdmin();
  const ids = bm.map(b => b.blog_post_id).filter((id): id is number => id !== null);
  const { data: posts } = await admin.from('blog_posts')
    .select('id, slug, title, category, excerpt, created_at, view_count, reading_time_min')
    .in('id', ids)
    .eq('is_published', true);

  return NextResponse.json({ bookmarks: posts ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { blogPostId } = await req.json();
  if (!blogPostId) return NextResponse.json({ error: 'Missing blogPostId' }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: existing } = await admin.from('blog_bookmarks')
    .select('id')
    .eq('blog_post_id', blogPostId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await admin.from('blog_bookmarks').delete().eq('id', existing.id);
    return NextResponse.json({ isBookmarked: false });
  } else {
    await admin.from('blog_bookmarks').insert({ blog_post_id: blogPostId, user_id: user.id });
    return NextResponse.json({ isBookmarked: true });
  }
}
