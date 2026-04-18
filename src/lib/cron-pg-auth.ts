/**
 * pg_cron 대체 인증 경로.
 *
 * 기존: Vercel cron 만 호출 → Bearer CRON_SECRET 검증
 * 신규: Supabase pg_cron 도 호출 → Bearer PG_CRON_SHARED_SECRET 또는 x-pg-cron-secret 헤더 허용
 *
 * 둘 중 하나라도 맞으면 통과. 스코프는 pg_cron으로 트리거되는 특정 루트에만 적용.
 * (전역 withCronAuth 는 변경하지 않음 — 블래스트 반경 확대 방지)
 */
export function verifyPgCronAuth(req: Request | { headers: { get(name: string): string | null } }): boolean {
  const authHeader = req.headers.get('authorization');
  const pgCronHeader = req.headers.get('x-pg-cron-secret');

  const cronSecret = process.env.CRON_SECRET;
  const pgCronSecret = process.env.PG_CRON_SHARED_SECRET;

  // 기존 Vercel cron 경로
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // 신규 pg_cron 경로 — 헤더 두 방식 모두 허용
  if (pgCronSecret) {
    if (authHeader === `Bearer ${pgCronSecret}`) return true;
    if (pgCronHeader === pgCronSecret) return true;
  }

  return false;
}
