export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getUSMarketSnapshot, generateUSBriefing, publishBriefingAsBlog } from '@/lib/us-market-cron-helpers';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('us-daily-recap-blog', async () => {
    const { topGainers, topLosers, sectorPerf } = await getUSMarketSnapshot();
    if (!topGainers.length && !topLosers.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_us_data' } };
    }
    const briefing = await generateUSBriefing({ type: 'daily_recap', topGainers, topLosers, sectorPerf, useSonnet: true });
    if (!briefing) return { processed: 1, created: 0, failed: 1, metadata: { reason: 'ai_failed' } };

    const kstDate = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    await publishBriefingAsBlog({
      title: `미국 증시 종합 브리핑 — ${kstDate}`,
      content: briefing.content,
      category: '주식',
      subCategory: '해외주식',
      tags: ['미국주식', '증시브리핑', '해외증시', 'S&P500', 'NASDAQ', '다우존스'],
    });

    return { processed: 1, created: 1, failed: 0, metadata: { api_name: 'anthropic', api_calls: briefing.apiCalls } };
  });
  return NextResponse.json(result);
}
