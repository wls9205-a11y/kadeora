import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const TARGETS = [
  '/api/cron/stock-fundamentals-kr',
  '/api/cron/stock-fundamentals-us',
  '/api/cron/apt-enrich-location',
  '/api/cron/data-quality-monitor',
  '/api/cron/batch-analysis-submit',
  '/api/cron/batch-cluster-submit',
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  const results: Record<string, string> = {};

  await Promise.allSettled(
    TARGETS.map(async (path) => {
      try {
        const res = await fetch(`${base}${path}`, {
          headers: { authorization: `Bearer ${cronSecret}` },
          signal: AbortSignal.timeout(50000),
        });
        results[path] = `${res.status}`;
      } catch (e: any) {
        results[path] = `error: ${e.message}`;
      }
    })
  );

  return NextResponse.json({ ok: true, results, triggered: TARGETS.length });
}
