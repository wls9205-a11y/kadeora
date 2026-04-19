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
  /** Redis 기반 lock TTL(초). 0 또는 미설정 시 lock 비활성. Vercel maxDuration 300 초과 시 자동 cap. */
  redisLockTtlSec?: number;
  /** Vercel maxDuration(초). TTL cap 산출용. 기본 300. */
  maxDurationSec?: number;
}

/** CI-v1 task2: Vercel 함수 timeout 대비 lock TTL 상한 — maxDuration - 30 */
function capLockTtl(requestedSec: number, maxDurationSec = 300): number {
  const cap = Math.max(30, maxDurationSec - 30);
  return Math.min(requestedSec, cap);
}

export async function withCronLogging(
  cronName: string,
  fn: () => Promise<CronResult>,
  options: CronOptions = {},
): Promise<{ success: boolean } & Partial<CronResult> & { error?: string; skipped?: boolean }> {
  const supabase = getSupabase();

  // CI-v1 task2: lock 획득 후 finally 로 release 보장 — 이전엔 try/catch 분기 release 로 누수 가능성
  let lockHeld = false;
  const effectiveTtl = options.redisLockTtlSec && options.redisLockTtlSec > 0
    ? capLockTtl(options.redisLockTtlSec, options.maxDurationSec ?? 300)
    : 0;

  if (effectiveTtl > 0) {
    const ok = await acquireCronLock(cronName, effectiveTtl);
    if (!ok) {
      console.warn(`[cron] ${cronName} skipped — redis lock held (ttl=${effectiveTtl}s)`);
      try {
        await supabase.from('cron_logs').insert({
          cron_name: cronName,
          status: 'skipped',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          error_message: 'redis_lock_held',
          metadata: { reason: 'redis_lock_held', ttl_sec: effectiveTtl },
        });
      } catch { /* ignore logging failure */ }
      return { success: true, skipped: true, processed: 0 };
    }
    lockHeld = true;
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

    return { success: true, ...result };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Sentry 에러 리포트
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

    await supabase.from('admin_alerts').insert({
      type: 'cron_fail',
      severity: 'error',
      title: `크론 실패: ${cronName}`,
      message: error.message?.substring(0, 500),
      metadata: { cron_name: cronName, duration_ms: duration },
    });

    try {
      const { NotificationBellService } = await import('@/lib/notification-bell');
      await NotificationBellService.pushCronFailure({
        cronName,
        error: error.message?.substring(0, 500) || 'unknown',
      });
    } catch { /* 벨 실패 무시 */ }

    return { success: false, error: error.message };
  } finally {
    // CI-v1 task2: finally 로 단일 release 보장 — try/catch 분기 release 제거
    if (lockHeld) {
      try { await releaseCronLock(cronName); }
      catch (e) { console.warn(`[cron] ${cronName} lock release failed:`, e); }
    }
  }
}
