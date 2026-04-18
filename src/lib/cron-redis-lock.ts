/**
 * [L1-4] Redis-backed cron lock (Upstash SET NX EX)
 *
 * DB 기반 cron-lock.ts와 병행 사용 가능.
 * Redis 쪽은 초단위 TTL 자동 해제 + 분산환경(Vercel serverless) 원자성.
 *
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 미설정 시
 * 잠금 없이 실행(기능 저해 금지) — lock 획득 성공으로 간주.
 */

export async function acquireCronLock(cronName: string, ttlSec = 600): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;
  const key = `cronlock:${cronName}`;
  try {
    // Upstash SET with NX + EX via /set?NX&EX
    const res = await fetch(`${url}/set/${encodeURIComponent(key)}/1?NX=true&EX=${ttlSec}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({ result: null }));
    return body?.result === 'OK';
  } catch {
    // Redis 장애 시 잠금 없이 진행 (데이터 정합성보다 가용성 우선)
    return true;
  }
}

export async function releaseCronLock(cronName: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const key = `cronlock:${cronName}`;
  try {
    await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch { /* ignore */ }
}

/**
 * withCronRedisLock — lock 획득 후 fn 실행, 마지막에 release.
 * 획득 실패 시 skipped true 리턴 (중복 실행 차단).
 */
export async function withCronRedisLock<T>(
  cronName: string,
  fn: () => Promise<T>,
  ttlSec = 600,
): Promise<{ skipped: true; reason: string } | { skipped: false; result: T }> {
  const ok = await acquireCronLock(cronName, ttlSec);
  if (!ok) return { skipped: true, reason: `${cronName} already running (redis lock)` };
  try {
    const result = await fn();
    return { skipped: false, result };
  } finally {
    await releaseCronLock(cronName);
  }
}
