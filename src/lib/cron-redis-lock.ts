/**
 * [L1-4] Redis-backed cron lock (Upstash SET NX EX)
 *
 * DB 기반 cron-lock.ts와 병행 사용 가능.
 * Redis 쪽은 초단위 TTL 자동 해제 + 분산환경(Vercel serverless) 원자성.
 *
 * 가용성 우선 정책(fail-open):
 *   - URL/TOKEN 미설정 → true (잠금 없이 진행)
 *   - 네트워크 예외                                       → true
 *   - Upstash HTTP 5xx / 429                              → true
 *   - Upstash HTTP 4xx (쿼터 초과, ERR 본문)              → true
 *   - body.error 필드 존재                                → true
 *   - 200 OK + body.result === 'OK'                       → true  (신규 획득)
 *   - 200 OK + body.result === null                       → false (실제 lock 보유자 있음 → skip)
 *
 * 즉 "lock 이 진짜로 선점된 경우" 에만 false. 외부 장애는 전부 fail-open 으로 크론 진행.
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

    // Upstash REST 는 쿼터 초과 시 400/429, 서비스 장애 시 5xx 반환.
    // 이 모든 비-2xx 는 "lock 상태 판단 불가" 이므로 fail-open.
    if (!res.ok) {
      console.warn(`[cron-redis-lock] ${cronName} acquire HTTP ${res.status} → fail-open`);
      return true;
    }

    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      console.warn(`[cron-redis-lock] ${cronName} acquire non-JSON body → fail-open`);
      return true;
    }

    // {"error": "ERR ..."} 형태도 fail-open (정상 200 이어도 본문에 error 오는 경우 대비)
    if ((body as { error?: unknown }).error) {
      console.warn(`[cron-redis-lock] ${cronName} acquire body.error → fail-open`);
      return true;
    }

    const result = (body as { result?: unknown }).result;
    if (result === 'OK') return true;       // 신규 획득
    if (result === null) return false;       // 실제 lock 선점자 있음

    // 예외적 응답(배열/숫자 등)도 fail-open
    console.warn(`[cron-redis-lock] ${cronName} acquire unexpected result=${JSON.stringify(result)} → fail-open`);
    return true;
  } catch (err: any) {
    // 네트워크 장애 등 — 가용성 우선
    console.warn(`[cron-redis-lock] ${cronName} acquire network error → fail-open: ${err?.message || err}`);
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
