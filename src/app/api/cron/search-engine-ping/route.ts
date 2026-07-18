import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SITEMAP = `${SITE_URL}/sitemap.xml`;

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
      // s258 patch #11: Google ping deprecated → naver indexnow + google sitemap notify 유지
      // 호스팅 키로 통일 (빈 키면 naver-indexnow ping 이 71일째 no-op). 타 route 와 동일.
      const indexNowKey = process.env.INDEXNOW_KEY || '3a23def313e1b1283822c54a0f9a5675';
      const results = await Promise.all([
        pingOne(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`, 'google'),
        pingOne(
          `https://searchadvisor.naver.com/indexnow?host=${new URL(SITE_URL).hostname}&key=${indexNowKey}&url=${encodeURIComponent(SITE_URL + '/')}`,
          'naver-indexnow'
        ),
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
