import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const sb = getSupabaseAdmin();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);

  const [issuesR, configR, statsR] = await Promise.all([
    (sb as any).from('issue_alerts')
      .select('id,title,summary,category,issue_type,final_score,is_processed,is_published,publish_decision,block_reason,blog_post_id,draft_title,draft_slug,draft_content,detected_keywords,related_entities,source_urls,detected_at,published_at,created_at')
      .order('detected_at', { ascending: false })
      .limit(50),
    sb.from('blog_publish_config')
      .select('auto_publish_enabled,auto_publish_min_score,auto_publish_blocked_categories')
      .eq('id', 1).single(),
    Promise.all([
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }).eq('is_published', true),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }).eq('publish_decision', 'draft'),
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }).eq('is_processed', false),
      // 오늘 발행 수
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true })
        .eq('is_published', true).gte('published_at', todayStart.toISOString()),
      // auto_failed (insert 실패)
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true })
        .eq('publish_decision', 'auto_failed'),
      // 40점 이상 대기
      (sb as any).from('issue_alerts').select('id', { count: 'exact', head: true })
        .eq('is_processed', false).gte('final_score', 40),
      // 오늘 cron 발행 한도 현황
      sb.from('blog_posts').select('id', { count: 'exact', head: true })
        .eq('cron_type', 'issue-draft').gte('created_at', todayStart.toISOString()),
    ]),
  ]);

  return NextResponse.json({
    issues: issuesR.data || [],
    config: configR.data || {},
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
