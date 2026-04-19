import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * CI-v1 Phase 1 통일 크론 인증 (Session B + Session C 병합).
 *
 * 허용 경로 — 4 중 하나라도 통과:
 *   1. Vercel cron 인프라 헤더:  x-vercel-cron: '1'  (Vercel 이 외부 요청에는 strip)
 *   2. Bearer CRON_SECRET          (기존 Vercel cron 방식)
 *   3. Bearer PG_CRON_SHARED_SECRET (신규 pg_cron / Supabase 호출)
 *   4. x-pg-cron-secret: <PG_CRON_SHARED_SECRET>
 */
export function verifyCronAuth(
  req: Request | NextRequest | { headers: { get(name: string): string | null } },
): boolean {
  // 1) Vercel cron 인프라 신호 (스푸핑 방지: Vercel 이 외부 strip)
  if (req.headers.get('x-vercel-cron') === '1') return true;

  const authHeader = req.headers.get('authorization');
  const pgCronHeader = req.headers.get('x-pg-cron-secret');

  const cronSecret = process.env.CRON_SECRET;
  const pgCronSecret = process.env.PG_CRON_SHARED_SECRET;

  // 2) Bearer — CRON_SECRET 또는 PG_CRON_SHARED_SECRET
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
 * Session B: verifyCronAuth 4 경로 기반으로 전환.
 * 기존 호출자(~50 cron 라우트) 그대로 사용 가능.
 *
 * @example
 * export const GET = withCronAuth(async (req) => {
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

/**
 * Session C 에서 도입된 별칭 — withCronAuth 와 동일 (verifyCronAuth 기반).
 *
 * 신규 pg_cron / 멀티 소스 라우트(issue-* 계열) 에서 명시적 사용.
 * withCronAuth 도 동일 인증 체인이라 기능적 차이는 없음.
 */
export const withCronAuthFlex = withCronAuth;
