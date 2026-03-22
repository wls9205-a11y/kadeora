import { getSupabaseAdmin } from './supabase-admin';

/**
 * withCronLock — 크론 중복 실행 방지
 * 같은 cronName이 lockMinutes 내에 이미 실행 중이면 스킵.
 * advisory lock 대신 DB 테이블 기반 (Vercel serverless 환경 호환)
 */
export async function withCronLock<T>(
  cronName: string,
  fn: () => Promise<T>,
  lockMinutes = 5,
): Promise<{ skipped: true; reason: string } | { skipped: false; result: T }> {
  const sb = getSupabaseAdmin();

  // 최근 lockMinutes 내에 running 상태인 로그가 있으면 스킵
  try {
    const since = new Date(Date.now() - lockMinutes * 60 * 1000).toISOString();
    const { data: running } = await sb.from('cron_logs')
      .select('id')
      .eq('cron_name', cronName)
      .eq('status', 'running')
      .gte('created_at', since)
      .limit(1);

    if (running && running.length > 0) {
      return { skipped: true, reason: `${cronName} already running (lock ${lockMinutes}min)` };
    }
  } catch {
    // Lock 체크 실패 시 그냥 실행 (lock 없는 것보다 나음)
  }

  // Lock 획득 (running 상태로 로그 삽입)
  let lockId: string | null = null;
  try {
    const { data: log } = await sb.from('cron_logs')
      .insert({ cron_name: cronName, status: 'running' })
      .select('id')
      .single();
    lockId = log?.id || null;
  } catch { }

  try {
    const result = await fn();

    // Lock 해제 (success로 업데이트)
    if (lockId) {
      await sb.from('cron_logs')
        .update({ status: 'success', finished_at: new Date().toISOString() })
        .eq('id', lockId);
    }

    return { skipped: false, result };
  } catch (error: any) {
    // Lock 해제 (failed로 업데이트)
    if (lockId) {
      await sb.from('cron_logs')
        .update({ status: 'failed', finished_at: new Date().toISOString(), error_message: error.message?.substring(0, 500) })
        .eq('id', lockId);
    }
    throw error;
  }
}
