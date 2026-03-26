import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 크론 라우트 인증 래퍼
 * 
 * 이전: 매 크론 라우트에서 3줄 인증 체크 반복 (21곳)
 * 이후: withCronAuth(handler)로 래핑
 * 
 * @example
 * export const GET = withCronAuth(async (req) => {
 *   // 비즈니스 로직만 작성
 *   return NextResponse.json({ ok: true });
 * });
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
