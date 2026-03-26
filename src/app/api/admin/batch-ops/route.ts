import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;

const BATCH_PRESETS: Record<string, { label: string; endpoints: string[] }> = {
  'all-data': {
    label: '전체 데이터 수집',
    endpoints: [
      '/api/cron/crawl-apt-subscription',
      '/api/cron/crawl-apt-trade',
      '/api/cron/crawl-competition-rate',
      '/api/cron/crawl-unsold-molit',
      '/api/cron/crawl-seoul-redev',
      '/api/cron/crawl-busan-redev',
      '/api/cron/crawl-gyeonggi-redev',
      '/api/cron/aggregate-trade-stats',
      '/api/stock-refresh',
      '/api/cron/exchange-rate',
    ],
  },
  'all-content': {
    label: '전체 콘텐츠 생성',
    endpoints: [
      '/api/cron/seed-posts',
      '/api/cron/seed-comments',
      '/api/cron/seed-chat',
      '/api/cron/blog-daily',
      '/api/cron/blog-publish-queue',
      '/api/cron/blog-seed-comments',
      '/api/cron/stock-daily-briefing',
    ],
  },
  'system-maintenance': {
    label: '시스템 유지보수',
    endpoints: [
      '/api/cron/health-check',
      '/api/cron/daily-stats',
      '/api/cron/auto-grade',
      '/api/cron/cleanup',
      '/api/cron/expire-listings',
    ],
  },
  'full-refresh': {
    label: '전체 새로고침 (데이터+콘텐츠+시스템)',
    endpoints: [
      '/api/cron/health-check',
      '/api/cron/crawl-apt-subscription',
      '/api/cron/crawl-apt-trade',
      '/api/cron/crawl-competition-rate',
      '/api/cron/crawl-unsold-molit',
      '/api/cron/crawl-seoul-redev',
      '/api/cron/crawl-busan-redev',
      '/api/cron/crawl-gyeonggi-redev',
      '/api/cron/aggregate-trade-stats',
      '/api/stock-refresh',
      '/api/cron/exchange-rate',
      '/api/cron/stock-daily-briefing',
      '/api/cron/seed-posts',
      '/api/cron/blog-publish-queue',
      '/api/cron/daily-stats',
      '/api/cron/auto-grade',
      '/api/cron/cleanup',
    ],
  },
};

export async function POST(req: NextRequest) {
  try {
    // 관리자 인증
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { preset, endpoints: customEndpoints } = await req.json();

    const endpoints = preset && BATCH_PRESETS[preset]
      ? BATCH_PRESETS[preset].endpoints
      : Array.isArray(customEndpoints) ? customEndpoints.filter((e: string) => e.startsWith('/api/')) : [];

    if (!endpoints.length) return NextResponse.json({ error: 'No endpoints' }, { status: 400 });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    const results: { endpoint: string; status: 'success' | 'error' | 'timeout'; duration: number; message?: string }[] = [];

    // 순차 실행 (동시 실행하면 DB 부하)
    for (const ep of endpoints) {
      const start = Date.now();
      try {
        const res = await Promise.race([
          fetch(`${baseUrl}${ep}`, {
            method: 'GET',
            headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
          }),
          new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000)),
        ]);
        const duration = Date.now() - start;
        results.push({
          endpoint: ep,
          status: res.ok ? 'success' : 'error',
          duration,
          message: res.ok ? 'OK' : `HTTP ${res.status}`,
        });
      } catch (e: unknown) {
        results.push({
          endpoint: ep,
          status: errMsg(e) === 'timeout' ? 'timeout' : 'error',
          duration: Date.now() - start,
          message: errMsg(e),
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const totalDuration = results.reduce((s, r) => s + r.duration, 0);

    return NextResponse.json({
      preset: preset || 'custom',
      total: endpoints.length,
      success: successCount,
      failed: endpoints.length - successCount,
      duration: totalDuration,
      results,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// GET: 프리셋 목록 반환
export async function GET() {
  return NextResponse.json({
    presets: Object.entries(BATCH_PRESETS).map(([key, val]) => ({
      key, label: val.label, count: val.endpoints.length,
    })),
  });
}
