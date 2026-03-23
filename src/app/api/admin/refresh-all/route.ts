import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';

export const maxDuration = 120;

const CRON_SEQUENCE = [
  { name: 'health-check', path: '/api/cron/health-check' },
  { name: 'stock-price', path: '/api/cron/stock-price' },
  { name: 'crawl-apt-trade', path: '/api/cron/crawl-apt-trade' },
  { name: 'crawl-apt-resale', path: '/api/cron/crawl-apt-resale' },
  { name: 'crawl-unsold-molit', path: '/api/cron/crawl-unsold-molit' },
  { name: 'crawl-seoul-redev', path: '/api/cron/crawl-seoul-redev' },
  { name: 'crawl-busan-redev', path: '/api/cron/crawl-busan-redev' },
  { name: 'crawl-nationwide-redev', path: '/api/cron/crawl-nationwide-redev' },
  { name: 'crawl-apt-subscription', path: '/api/cron/crawl-apt-subscription' },
  { name: 'crawl-competition-rate', path: '/api/cron/crawl-competition-rate' },
  { name: 'seed-posts', path: '/api/cron/seed-posts' },
  { name: 'daily-stats', path: '/api/cron/daily-stats' },
  { name: 'aggregate-trade-stats', path: '/api/cron/aggregate-trade-stats' },
  { name: 'exchange-rate', path: '/api/cron/exchange-rate' },
  { name: 'stock-theme-daily', path: '/api/cron/stock-theme-daily' },
  { name: 'stock-daily-briefing', path: '/api/cron/stock-daily-briefing' },
  { name: 'auto-grade', path: '/api/cron/auto-grade' },
  { name: 'invest-calendar', path: '/api/cron/invest-calendar-refresh' },
  { name: 'stock-news', path: '/api/cron/stock-news-crawl' },
  { name: 'stock-flow', path: '/api/cron/stock-flow-crawl' },
];

export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  const secret = process.env.CRON_SECRET || '';
  const results: any[] = [];
  const BATCH_SIZE = 5;

  // 5개씩 병렬 배치 실행 (순차 22개 → 병렬 5배치, 504 방지)
  for (let i = 0; i < CRON_SEQUENCE.length; i += BATCH_SIZE) {
    const batch = CRON_SEQUENCE.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (cron) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);
          const res = await fetch(`${baseUrl}${cron.path}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${secret}` },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          return { name: cron.name, status: res.ok ? 'success' : 'failed', statusCode: res.status };
        } catch (error: any) {
          return { name: cron.name, status: 'error', error: error.message?.slice(0, 100) };
        }
      })
    );
    settled.forEach(r => {
      results.push(r.status === 'fulfilled' ? r.value : { name: '?', status: 'error' });
    });
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status !== 'success').length;

  try {
    await getSupabaseAdmin().from('admin_alerts').insert({
      type: 'system',
      severity: failCount > 0 ? 'warning' : 'info',
      title: `전체 갱신 완료: ${successCount}/${results.length} 성공`,
      message: failCount > 0
        ? `실패: ${results.filter(r => r.status !== 'success').map(r => r.name).join(', ')}`
        : '모든 크론이 정상 실행되었습니다.',
      metadata: { results },
    });
  } catch {}

  return NextResponse.json({ success: true, results, summary: { successCount, failCount } });
}
