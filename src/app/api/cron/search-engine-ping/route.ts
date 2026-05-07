import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SITEMAP = 'https://kadeora.app/sitemap.xml';

async function pingOne(url: string, label: string): Promise<{ label: string; status: number | string }> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return { label, status: r.status };
  } catch (e: any) {
    return { label, status: `err:${e?.message?.slice(0, 30) || 'unknown'}` };
  }
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('search-engine-ping', async () => {
      const results = await Promise.all([
        pingOne(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`, 'google'),
        pingOne(`https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`, 'bing'),
      ]);

      const okCount = results.filter(r => typeof r.status === 'number' && r.status >= 200 && r.status < 400).length;
      return {
        processed: results.length,
        created: 0,
        updated: okCount,
        failed: results.length - okCount,
        metadata: { results },
      };
    })
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
