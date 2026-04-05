import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sanitizeId } from '@/lib/sanitize';
import { createSupabaseServer } from '@/lib/supabase-server';

const recentActions = new Map<string, number>();

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, "api"))) return rateLimitResponse();
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
  if (!(await rateLimit(req, "api"))) return rateLimitResponse();
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { blogPostId } = await req.json();
  if (!blogPostId) return NextResponse.json({ error: 'Missing blogPostId' }, { status: 400 });

  // Rate limit: 1 action per user+post per 2 seconds
  const rateKey = `${user.id}:${blogPostId}`;
  const now = Date.now();
  if (recentActions.has(rateKey) && now - recentActions.get(rateKey)! < 2000) {
    return NextResponse.json({ error: 'Too fast' }, { status: 429 });
  }
  recentActions.set(rateKey, now);
  if (recentActions.size > 5000) { const keys = [...recentActions.keys()].slice(0, 2500); keys.forEach(k => recentActions.delete(k)); }

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
