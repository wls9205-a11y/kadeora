import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const sb = getSupabaseAdmin();

  const [issuesR, configR, statsR] = await Promise.all([
    (sb as any).from('issue_alerts')
      .select('id,title,summary,category,issue_type,final_score,is_processed,is_published,publish_decision,block_reason,blog_post_id,draft_title,draft_slug,draft_content,detected_keywords,related_entities,source_urls,detected_at,published_at')
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
    },
  });
}
