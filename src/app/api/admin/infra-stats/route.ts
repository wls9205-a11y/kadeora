import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const supabaseAdmin = getAdminClient();
  // Admin auth check
  const { createSupabaseServer } = await import('@/lib/supabase-server');
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // 1. Supabase DB stats via RPC
  let dbStats = null;
  try {
    const { data } = await supabaseAdmin.rpc('get_db_stats');
    dbStats = data;
  } catch (e) {
    console.error('[infra-stats] DB stats error:', e);
  }

  // 2. Weekly active users
  let weeklyActive = 0;
  try {
    const { data } = await supabaseAdmin.rpc('get_weekly_active_users');
    weeklyActive = data ?? 0;
  } catch {}

  // 3. GitHub repo info (public API, cached)
  let github = null;
  try {
    const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' };
    if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;

    const [repoRes, commitsRes] = await Promise.all([
      fetch('https://api.github.com/repos/wls9205-a11y/kadeora', { headers, next: { revalidate: 3600 } as any }),
      fetch('https://api.github.com/repos/wls9205-a11y/kadeora/commits?per_page=5', { headers, next: { revalidate: 600 } as any }),
    ]);

    if (repoRes.ok) {
      const repo = await repoRes.json();
      const commits = commitsRes.ok ? await commitsRes.json() : [];
      github = {
        size_kb: repo.size,
        size_pretty: repo.size > 1024 ? `${(repo.size / 1024).toFixed(1)}MB` : `${repo.size}KB`,
        stars: repo.stargazers_count,
        open_issues: repo.open_issues_count,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at,
        recent_commits: Array.isArray(commits) ? commits.map((c: any) => ({
          sha: c.sha?.slice(0, 7),
          message: c.commit?.message?.split('\n')[0]?.slice(0, 60),
          date: c.commit?.author?.date,
          author: c.commit?.author?.name,
        })) : [],
      };
    }
  } catch {}

  // 4. Vercel deployments (requires VERCEL_TOKEN)
  let vercel: any = null;
  const vercelToken = process.env.VERCEL_TOKEN;
  if (vercelToken) {
    try {
      const res = await fetch(
        'https://api.vercel.com/v6/deployments?limit=5&projectId=' + (process.env.VERCEL_PROJECT_ID || ''),
        { headers: { Authorization: `Bearer ${vercelToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        vercel = {
          deployments: (data.deployments ?? []).map((d: any) => ({
            id: d.uid,
            url: d.url,
            state: d.state ?? d.readyState,
            created: d.created,
            meta: d.meta?.githubCommitMessage || '',
          })),
        };
      }
    } catch {}
  }
  if (!vercel) {
    vercel = { message: 'VERCEL_TOKEN 환경변수를 추가하면 배포 정보를 볼 수 있습니다' };
  }

  return NextResponse.json({ dbStats, weeklyActive, github, vercel });
}
