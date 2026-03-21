import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CRON_SEQUENCE = [
  { name: 'health-check', path: '/api/cron/health-check' },
  { name: 'stock-price', path: '/api/cron/stock-price' },
  { name: 'crawl-apt-trade', path: '/api/cron/crawl-apt-trade' },
  { name: 'crawl-apt-resale', path: '/api/cron/crawl-apt-resale' },
  { name: 'crawl-unsold-molit', path: '/api/cron/crawl-unsold-molit' },
  { name: 'crawl-seoul-redev', path: '/api/cron/crawl-seoul-redev' },
  { name: 'crawl-busan-redev', path: '/api/cron/crawl-busan-redev' },
  { name: 'seed-posts', path: '/api/cron/seed-posts' },
  { name: 'daily-stats', path: '/api/cron/daily-stats' },
];

export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  const results: any[] = [];

  for (const cron of CRON_SEQUENCE) {
    try {
      const res = await fetch(`${baseUrl}${cron.path}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      results.push({
        name: cron.name,
        status: res.ok ? 'success' : 'failed',
        statusCode: res.status,
        data,
      });
    } catch (error: any) {
      results.push({
        name: cron.name,
        status: 'error',
        error: error.message,
      });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status !== 'success').length;

  await getSupabase().from('admin_alerts').insert({
    type: 'system',
    severity: failCount > 0 ? 'warning' : 'info',
    title: `전체 갱신 완료: ${successCount}/${results.length} 성공`,
    message: failCount > 0
      ? `실패: ${results.filter(r => r.status !== 'success').map(r => r.name).join(', ')}`
      : '모든 크론이 정상 실행되었습니다.',
    metadata: { results },
  });

  return NextResponse.json({ success: true, results, summary: { successCount, failCount } });
}
