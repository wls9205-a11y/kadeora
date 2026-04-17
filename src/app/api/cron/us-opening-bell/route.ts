export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getUSMarketSnapshot, generateUSBriefing, saveBriefing } from '@/lib/us-market-cron-helpers';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('us-opening-bell', async () => {
    const { topGainers, topLosers, sectorPerf } = await getUSMarketSnapshot();
    if (!topGainers.length && !topLosers.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_us_data' } };
    }
    const briefing = await generateUSBriefing({ type: 'opening', topGainers, topLosers, sectorPerf });
    if (!briefing) return { processed: 1, created: 0, failed: 1, metadata: { reason: 'ai_failed' } };
    await saveBriefing({ market: 'US', title: briefing.title, summary: briefing.content.slice(0, 500), topGainers, topLosers, briefingType: 'opening' });
    return { processed: 1, created: 1, failed: 0, metadata: { api_name: 'anthropic', api_calls: briefing.apiCalls } };
  });
  return NextResponse.json(result);
}
