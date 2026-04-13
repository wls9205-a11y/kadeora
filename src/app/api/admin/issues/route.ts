import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const sb = getSupabaseAdmin();
  // KST 기준 오늘 시작 (UTC+9)
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
  todayStart.setTime(todayStart.getTime() - 9 * 60 * 60 * 1000); // KST 00:00 → UTC

  // config 먼저 가져와서 minScore 동적 사용
  const { data: config } = await sb.from('blog_publish_config')
    .select('auto_publish_enabled,auto_publish_min_score,auto_publish_blocked_categories')
    .eq('id', 1).maybeSingle();
  const minScore = config?.auto_publish_min_score ?? 40;

  const [issuesR, statsR] = await Promise.all([
    (sb as any).from('issue_alerts')
      .select('id,title,summary,category,issue_type,final_score,is_processed,is_published,is_auto_publish,publish_decision,block_reason,blog_post_id,draft_title,draft_slug,draft_content,detected_keywords,related_entities,source_urls,detected_at,published_at,created_at,fact_check_passed')
      .order('detected_at', { ascending: false })
      .limit(50),
    Promise.all([
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }).eq('is_published', true),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }).in('publish_decision', ['draft', 'draft_saved']),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }).eq('is_processed', false),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true })
        .eq('is_published', true).gte('published_at', todayStart.toISOString()),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true })
        .eq('publish_decision', 'auto_failed'),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true })
        .eq('is_processed', false).gte('final_score', minScore),
      sb.from('blog_posts').select('id', { count: 'exact', head: true })
        .eq('cron_type', 'issue-draft').gte('created_at', todayStart.toISOString()),
    ]),
  ]);

  return NextResponse.json({
    issues: issuesR.data || [],
    config: config || {},
    stats: {
      total: statsR[0].count || 0,
      published: statsR[1].count || 0,
      draft: statsR[2].count || 0,
      pending: statsR[3].count || 0,
      publishedToday: statsR[4].count || 0,
      autoFailed: statsR[5].count || 0,
      pending40plus: statsR[6].count || 0,
      cronLimitUsed: statsR[7].count || 0,
      cronLimitMax: 30,
    },
  });
}
