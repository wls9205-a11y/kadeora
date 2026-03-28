import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const blogPostId = req.nextUrl.searchParams.get('blogPostId');
  if (!blogPostId) return NextResponse.json({ error: 'Missing blogPostId' }, { status: 400 });

  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ isHelpful: false });

  const { data } = await sb.from('blog_helpful')
    .select('id')
    .eq('blog_post_id', Number(blogPostId))
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ isHelpful: !!data });
}

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { blogPostId } = await req.json();
  if (!blogPostId) return NextResponse.json({ error: 'Missing blogPostId' }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Check existing
  const { data: existing } = await admin.from('blog_helpful')
    .select('id')
    .eq('blog_post_id', blogPostId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // Remove
    await admin.from('blog_helpful').delete().eq('id', existing.id);
    // Decrement count
    const { data: post } = await admin.from('blog_posts').select('helpful_count').eq('id', blogPostId).single();
    const newCount = Math.max(0, (post?.helpful_count ?? 1) - 1);
    await admin.from('blog_posts').update({ helpful_count: newCount }).eq('id', blogPostId);
    return NextResponse.json({ isHelpful: false, helpfulCount: newCount });
  } else {
    // Add
    await admin.from('blog_helpful').insert({ blog_post_id: blogPostId, user_id: user.id });
    const { data: post } = await admin.from('blog_posts').select('helpful_count').eq('id', blogPostId).single();
    const newCount = (post?.helpful_count ?? 0) + 1;
    await admin.from('blog_posts').update({ helpful_count: newCount }).eq('id', blogPostId);
    return NextResponse.json({ isHelpful: true, helpfulCount: newCount });
  }
}
