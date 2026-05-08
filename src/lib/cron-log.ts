// s258 shim — apt-summary-gen / naver-sc-sync 신규 cron 이 사용하는
// logCronStart / logCronEnd API. 기존 withCronLogging 와 동일 cron_logs 스키마 사용.

export type CronLogEnd = {
  status?: 'success' | 'error' | 'partial';
  records_processed?: number;
  records_created?: number;
  records_updated?: number;
  records_failed?: number;
  error_message?: string | null;
  metadata?: Record<string, any> | null;
};

export async function logCronStart(supabase: any, cronName: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('cron_logs')
      .insert({
        cron_name: cronName,
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select('id')
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function logCronEnd(
  supabase: any,
  cronId: string | null,
  result: CronLogEnd,
): Promise<void> {
  if (!cronId) return;
  try {
    const finished_at = new Date().toISOString();
    await supabase
      .from('cron_logs')
      .update({
        finished_at,
        status: result.status ?? (result.records_failed && result.records_failed > 0 ? 'partial' : 'success'),
        records_processed: result.records_processed ?? 0,
        records_created: result.records_created ?? 0,
        records_updated: result.records_updated ?? 0,
        records_failed: result.records_failed ?? 0,
        error_message: result.error_message ?? null,
        metadata: result.metadata ?? null,
      })
      .eq('id', cronId);
  } catch {
    // silent
  }
}
