import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const revalidate = 0;

export async function GET() {
  const start = Date.now();
  try {
    const sb = getSupabaseAdmin();

    const [postsR, usersR, commentsR, todayR] = await Promise.all([
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('comments').select('id', { count: 'exact', head: true }),
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ]);

    const latency = Date.now() - start;
    return Response.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      checks: { database: { status: 'ok', latency_ms: latency } },
      stats: {
        posts: postsR.count ?? 0,
        users: usersR.count ?? 0,
        comments: commentsR.count ?? 0,
        posts_today: todayR.count ?? 0,
      },
    });
  } catch (e) {
    return Response.json({ status: 'error', timestamp: new Date().toISOString(), error: (e as Error).message }, { status: 503 });
  }
}
