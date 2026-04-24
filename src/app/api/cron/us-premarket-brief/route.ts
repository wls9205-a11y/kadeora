export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import {
  getUSMarketSnapshot,
  generateUSBriefing,
  saveBriefing,
  publishBriefingAsBlog,
} from '@/lib/us-market-cron-helpers';

/**
 * 미국 프리마켓 워치리스트 크론
 * KST 21:30 (US ET 08:30) 실행
 * 프리마켓 주요 등락 종목 + 오늘의 관전 포인트
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('us-premarket-brief', async () => {
    const { topGainers, topLosers, sectorPerf } = await getUSMarketSnapshot();

    if (!topGainers.length && !topLosers.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_us_data' } };
    }

    const briefing = await generateUSBriefing({
      type: 'premarket',
      topGainers,
      topLosers,
      sectorPerf,
    });

    if (!briefing) {
      return { processed: 1, created: 0, failed: 1, metadata: { reason: 'ai_failed' } };
    }

    // DB 저장
    await saveBriefing({
      market: 'US',
      title: briefing.title,
      summary: briefing.content.slice(0, 500),
      topGainers,
      topLosers,
      briefingType: 'premarket',
    });

    // 블로그 발행
    const kstDate = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    await publishBriefingAsBlog({
      title: `[프리마켓] ${briefing.title} — ${kstDate}`,
      content: briefing.content,
      category: '주식',
      subCategory: '해외주식',
      tags: ['미국주식', '프리마켓', '해외증시', 'S&P500', 'NASDAQ'],
    });

    return {
      processed: 1,
      created: 1,
      failed: 0,
      metadata: { api_name: 'anthropic', api_calls: briefing.apiCalls },
    };
  });

  return NextResponse.json(result);
}
