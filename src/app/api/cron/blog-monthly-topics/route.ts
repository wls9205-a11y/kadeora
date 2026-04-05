import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * blog-monthly-topics 디스패처
 * 매일 02:00 실행 → 오늘 날짜에 해당하는 월간 블로그 토픽 크론을 내부 호출
 * 16개 개별 vercel.json 크론 → 1개로 통합 (15개 크론 슬롯 절약)
 */

const TOPIC_MAP: Record<number, string[]> = {
  1: ['blog-trade-trend'],
  2: ['blog-stock-deep', 'blog-etf-compare', 'blog-adr-compare'],
  3: ['blog-redev-summary'],
  4: ['blog-theme-stocks'],
  5: ['blog-invest-calendar'],
  6: ['blog-comparison'],
  7: ['blog-life-guide'],
  8: ['blog-district-guide'],
  9: ['blog-competition-rate'],
  10: ['blog-investor-flow'],
  11: ['blog-disclosure'],
  12: ['blog-exchange-rate'],
  13: ['blog-unsold-trend'],
  14: ['blog-builder-analysis'],
};

export const maxDuration = 120;

async function handler(req: NextRequest): Promise<NextResponse> {
  const result = await withCronLogging('blog-monthly-topics', async () => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayOfMonth = kst.getUTCDate();

    const topics = TOPIC_MAP[dayOfMonth];
    if (!topics || topics.length === 0) {
      return { processed: 0, metadata: { day: dayOfMonth, message: 'No topics for today' } };
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const secret = process.env.CRON_SECRET || '';

    let dispatched = 0;
    let failed = 0;

    for (const topic of topics) {
      try {
        const res = await fetch(`${baseUrl}/api/cron/${topic}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (res.ok) dispatched++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return { processed: dispatched, failed, metadata: { day: dayOfMonth, topics } };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
