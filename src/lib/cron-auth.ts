import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 크론 라우트 인증 래퍼 (Vercel cron 전용, 기존 호환용)
 *
 * 새 pg_cron / 멀티 소스 경로에는 withCronAuthFlex / verifyCronAuth 를 사용.
 */
export function withCronAuth(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

/**
 * 멀티 소스 크론 인증.
 *
 * Session B/C 공용. 아래 4가지 중 하나라도 맞으면 통과:
 *   1. Vercel cron       — Bearer CRON_SECRET
 *   2. Vercel cron       — x-vercel-cron 헤더 존재 (인프라 자동 부여)
 *   3. pg_cron           — Bearer PG_CRON_SHARED_SECRET
 *   4. pg_cron           — x-pg-cron-secret: PG_CRON_SHARED_SECRET
 */
export function verifyCronAuth(
  req: Request | { headers: { get(name: string): string | null } },
): boolean {
  const authHeader = req.headers.get('authorization');
  const pgCronHeader = req.headers.get('x-pg-cron-secret');
  const vercelCronHeader = req.headers.get('x-vercel-cron');

  const cronSecret = process.env.CRON_SECRET;
  const pgCronSecret = process.env.PG_CRON_SHARED_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Vercel 인프라가 자동 부여 — 존재만으로 통과 (스푸핑 방지용으로 Vercel 이
  // 외부 요청에는 strip 처리)
  if (vercelCronHeader) return true;

  if (pgCronSecret) {
    if (authHeader === `Bearer ${pgCronSecret}`) return true;
    if (pgCronHeader === pgCronSecret) return true;
  }

  return false;
}

/**
 * withCronAuth 의 멀티 소스 버전.
 *
 * Vercel cron / pg_cron 양쪽에서 호출되는 라우트에 사용.
 */
export function withCronAuthFlex(
  handler: (req: NextRequest) => Promise<NextResponse>,
) {
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
