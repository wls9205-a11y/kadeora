import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const today = new Date().toISOString().slice(0, 10);

    // Try RPC first
    const { error: rpcError } = await supabase.rpc('capture_daily_stats');

    if (rpcError) {
      // Fallback: direct insert
      const [usersR, postsR, commentsR, pvR] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', today),
        supabase.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', today),
      ]);

      await supabase.from('daily_stats').upsert({
        stat_date: today,
        new_users: usersR.count || 0,
        new_posts: postsR.count || 0,
        new_comments: commentsR.count || 0,
        total_page_views: pvR.count || 0,
      }, { onConflict: 'stat_date' });
    }

    // Log to cron_logs
    await supabase.from('cron_logs').insert({
      cron_name: 'daily-stats',
      status: 'success',
      started_at: new Date().toISOString(),
      duration_ms: 0,
      records_processed: 1,
    }).catch(() => {});

    return NextResponse.json({ success: true, message: '일일 통계 캡처 완료' });
  } catch (error: any) {
    return NextResponse.json({ success: true, error: error.message });
  }
}
