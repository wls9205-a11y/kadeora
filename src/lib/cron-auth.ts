import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * CI-v1 Phase 1 통일 크론 인증.
 *
 * 허용 경로 (3 중 하나라도 통과):
 *   1. Vercel cron:  x-vercel-cron: '1'  (Vercel 이 자동 주입)
 *   2. Bearer 토큰:   Authorization: Bearer <PG_CRON_SHARED_SECRET | CRON_SECRET>
 *   3. pg_cron 헤더:  x-pg-cron-secret: <PG_CRON_SHARED_SECRET>
 *
 * 하위호환: CRON_SECRET 도 여전히 유효 (기존 withCronAuth 대체).
 * 신규 호출자는 verifyCronAuth 를 직접 사용하거나 withCronAuth 래퍼 경유.
 */
export function verifyCronAuth(
  req: Request | NextRequest | { headers: { get(name: string): string | null } },
): boolean {
  // 1) Vercel cron 내부 신호
  if (req.headers.get('x-vercel-cron') === '1') return true;

  const authHeader = req.headers.get('authorization');
  const pgCronHeader = req.headers.get('x-pg-cron-secret');

  const cronSecret = process.env.CRON_SECRET;
  const pgCronSecret = process.env.PG_CRON_SHARED_SECRET;

  // 2) Bearer 토큰 — CRON_SECRET (Vercel cron 용 기존) 또는 PG_CRON_SHARED_SECRET (pg_cron)
  if (authHeader) {
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
    if (pgCronSecret && authHeader === `Bearer ${pgCronSecret}`) return true;
  }

  // 3) pg_cron 전용 헤더
  if (pgCronSecret && pgCronHeader === pgCronSecret) return true;

  return false;
}

/**
 * 크론 라우트 인증 + 에러 핸들링 래퍼.
 *
 * 과거: 매 크론 라우트에서 3줄 인증 체크 반복 (21곳)
 * 현재: withCronAuth(handler) — 3 경로 중 하나로 통과
 *
 * @example
 * export const GET = withCronAuth(async (req) => {
 *   // 비즈니스 로직만 작성
 *   return NextResponse.json({ ok: true });
 * });
 */
export function withCronAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      return await handler(req);
    } catch (e: unknown) {
      console.error(`[Cron Error]`, e);
      return NextResponse.json({ error: errMsg(e) }, { status: 200 });
    }
  };
}
