import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface CronResult {
  processed?: number;
  created?: number;
  updated?: number;
  failed?: number;
  metadata?: Record<string, any>;
}

export async function withCronLogging(
  cronName: string,
  fn: () => Promise<CronResult>
): Promise<{ success: boolean } & Partial<CronResult> & { error?: string }> {
  const supabase = getSupabase();
  const { data: log } = await supabase
    .from('cron_logs')
    .insert({ cron_name: cronName, status: 'running' })
    .select('id')
    .single();

  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    await supabase
      .from('cron_logs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        records_processed: result.processed || 0,
        records_created: result.created || 0,
        records_updated: result.updated || 0,
        records_failed: result.failed || 0,
        metadata: result.metadata || {},
      })
      .eq('id', log?.id);

    // API 사용량 추적
    if (result.metadata?.api_name) {
      await supabase.rpc('increment_api_usage', {
        p_api_name: result.metadata.api_name,
        p_count: result.metadata.api_calls || 1,
      });
    }

    return { success: true, ...result };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    await supabase
      .from('cron_logs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        error_message: error.message?.substring(0, 1000),
      })
      .eq('id', log?.id);

    // 실패 알림 자동 생성
    await supabase.from('admin_alerts').insert({
      type: 'cron_fail',
      severity: 'error',
      title: `크론 실패: ${cronName}`,
      message: error.message?.substring(0, 500),
      metadata: { cron_name: cronName, duration_ms: duration },
    });

    return { success: false, error: error.message };
  }
}
