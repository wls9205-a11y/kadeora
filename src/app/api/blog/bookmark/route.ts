import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sanitizeId } from '@/lib/sanitize';
import { createSupabaseServer } from '@/lib/supabase-server';

const recentActions = new Map<string, number>();

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, "api"))) return rateLimitResponse();
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

    // 첫 미션: 글 저장
    try {
      const { data: prof } = await (admin as any).from('profiles').select('first_mission_completed, first_mission_progress').eq('id', user.id).single();
      if (prof && !prof.first_mission_completed) {
        const prog = (prof as any).first_mission_progress || {};
        if (!prog.bookmark) {
          prog.bookmark = true;
          const done = Object.values(prog).filter(Boolean).length;
          if (done >= 2) await (admin as any).rpc('award_points', { p_user_id: user.id, p_amount: 200, p_reason: '첫 미션 보너스' });
          await (admin as any).from('profiles').update({ first_mission_progress: prog, first_mission_completed: done >= 2 }).eq('id', user.id);
        }
      }
    } catch {}

    return NextResponse.json({ isBookmarked: true });
  }
}
