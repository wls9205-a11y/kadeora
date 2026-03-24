import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
  return NextResponse.json({
    status: 'ok',
    sitemap: 'https://kadeora.app/sitemap.xml',
    timestamp: new Date().toISOString(),
  });

  } catch (e) {
    console.error('[src/app/api/ping/route.ts]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
