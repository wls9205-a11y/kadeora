import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { acquireCronLock, releaseCronLock } from '@/lib/cron-redis-lock';

function getSupabase() {
  return getSupabaseAdmin();
}

interface CronResult {
  processed?: number;
  created?: number;
  updated?: number;
  failed?: number;
  metadata?: Record<string, any>;
}

interface CronOptions {
  /** Redis 기반 lock TTL(초). 0 또는 미설정 시 lock 비활성. */
  redisLockTtlSec?: number;
}

export async function withCronLogging(
  cronName: string,
  fn: () => Promise<CronResult>,
  options: CronOptions = {},
): Promise<{ success: boolean } & Partial<CronResult> & { error?: string; skipped?: boolean }> {
  const supabase = getSupabase();

  // [L1-4] Redis 기반 중복 실행 차단 (옵션)
  // 세션 140 [P0-IMAGE]: lock 획득 실패 시에도 cron_logs 에 skipped 로우 INSERT → 관측 가능
  if (options.redisLockTtlSec && options.redisLockTtlSec > 0) {
    const ok = await acquireCronLock(cronName, options.redisLockTtlSec);
    if (!ok) {
      console.warn(`[cron] ${cronName} skipped — redis lock held`);
      try {
        await supabase.from('cron_logs').insert({
          cron_name: cronName,
          status: 'skipped',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          error_message: 'redis_lock_held',
          metadata: { reason: 'redis_lock_held', ttl_sec: options.redisLockTtlSec },
        });
      } catch { /* ignore logging failure — 실행 자체는 skip 되었으므로 응답은 정상 */ }
      return { success: true, skipped: true, processed: 0 };
    }
  }

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
      .eq('id', log?.id as string);

    // API 사용량 추적
    if (result.metadata?.api_name) {
      await supabase.rpc('increment_api_usage', {
        p_api_name: result.metadata.api_name,
        p_count: result.metadata.api_calls || 1,
      });
    }

    if (options.redisLockTtlSec && options.redisLockTtlSec > 0) {
      await releaseCronLock(cronName);
    }

    return { success: true, ...result };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Sentry 에러 리포트 (크론 컨텍스트 태그 포함)
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureException(error, {
        tags: { source: 'cron', cron_name: cronName },
        extra: { duration_ms: duration },
      });
    } catch {}

    await supabase
      .from('cron_logs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        error_message: error.message?.substring(0, 1000),
      })
      .eq('id', log?.id as string);

    // 실패 알림 자동 생성
    await supabase.from('admin_alerts').insert({
      type: 'cron_fail',
      severity: 'error',
      title: `크론 실패: ${cronName}`,
      message: error.message?.substring(0, 500),
      metadata: { cron_name: cronName, duration_ms: duration },
    });

    // [NOTIFY-BELL] 세션 140: 관리자 벨에도 즉시 push (무료·실시간)
    try {
      const { NotificationBellService } = await import('@/lib/notification-bell');
      await NotificationBellService.pushCronFailure({
        cronName,
        error: error.message?.substring(0, 500) || 'unknown',
      });
    } catch { /* 벨 실패는 무시 */ }

    if (options.redisLockTtlSec && options.redisLockTtlSec > 0) {
      await releaseCronLock(cronName);
    }

    return { success: false, error: error.message };
  }
}
