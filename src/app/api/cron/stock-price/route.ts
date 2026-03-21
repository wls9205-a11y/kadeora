import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-price', async () => {
    // KIS API 키 미설정 - apiportal.koreainvestment.com에서 발급 필요
    // KIS_APP_KEY, KIS_APP_SECRET 환경변수 등록 후 구현 예정
    return { processed: 0, created: 0, failed: 0, metadata: {} };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: 'KIS API not configured yet' });
}
