import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await admin.rpc('get_seed_stats');

    if (error || !data || data.length === 0) {
      return NextResponse.json({ users: 0, posts: 0, comments: 0, likes: 0 });
    }

    const row = data[0];
    return NextResponse.json({
      users: Number(row.seed_users) || 0,
      posts: Number(row.seed_posts) || 0,
      comments: Number(row.seed_comments) || 0,
      likes: Number(row.seed_likes) || 0,
    });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
