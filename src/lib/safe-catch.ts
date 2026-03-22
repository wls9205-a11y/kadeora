/**
 * silentCatch — 빈 catch 블록 대체 유틸
 * 프로덕션에서는 Sentry로 리포트, 개발에서는 console.warn
 * 
 * 사용법:
 *   try { ... } catch (e) { silentCatch(e, 'FeedClient.loadPosts'); }
 */
export function silentCatch(error: unknown, context?: string) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[silentCatch${context ? `:${context}` : ''}]`, error);
  }
  // Sentry 리포트 (production에서만, 비동기로 성능 무영향)
  if (typeof window !== 'undefined') {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.captureException(error, { tags: { context: context || 'unknown' } });
    }).catch(() => {});
  }
}

/**
 * trySafe — try-catch 래퍼
 * 
 * 사용법:
 *   const result = await trySafe(() => fetchData(), 'fetchData');
 *   if (result !== null) { ... }
 */
export async function trySafe<T>(
  fn: () => Promise<T>,
  context?: string,
  fallback: T | null = null
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    silentCatch(e, context);
    return fallback;
  }
}
