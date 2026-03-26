import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const maxDuration = 300; // 5분

/* ═══════════════════════════════════════════════════════════
   🚀 GOD MODE API - 모든 크론을 최대 병렬로 실행
   POST /api/admin/god-mode
   body: { mode: 'full' | 'data' | 'content' | 'system' | 'failed' }
═══════════════════════════════════════════════════════════ */

// 크론 그룹별 정의 (의존성 고려한 실행 순서)
const CRON_GROUPS = {
  // Phase 1: 데이터 수집 (가장 먼저, 독립적)
  data: [
    '/api/cron/crawl-apt-subscription',
    '/api/cron/crawl-apt-trade',
    '/api/cron/crawl-apt-resale',
    '/api/cron/crawl-competition-rate',
    '/api/cron/crawl-unsold-molit',
    '/api/cron/crawl-seoul-redev',
    '/api/cron/crawl-busan-redev',
    '/api/cron/crawl-gyeonggi-redev',
    '/api/cron/crawl-nationwide-redev',
    '/api/stock-refresh',           // ⚠️ /api/cron 아님
    '/api/cron/exchange-rate',
    '/api/cron/stock-news-crawl',
    '/api/cron/stock-flow-crawl',
    '/api/cron/stock-price',
    '/api/cron/invest-calendar-refresh',
  ],
  // Phase 2: 데이터 가공 (수집 후)
  process: [
    '/api/cron/aggregate-trade-stats',
    '/api/cron/sync-apt-sites',
    '/api/cron/stock-theme-daily',
    '/api/cron/redev-verify-households',
    '/api/cron/redev-geocode',
    '/api/cron/apt-backfill-details',
  ],
  // Phase 3: AI 생성 (가공 후)
  ai: [
    '/api/cron/apt-ai-summary',
    '/api/cron/stock-daily-briefing',
    '/api/cron/collect-site-images',
    '/api/cron/collect-site-trends',
    '/api/cron/collect-site-facilities',
    '/api/cron/blog-rewrite',
  ],
  // Phase 4: 콘텐츠 생성
  content: [
    '/api/cron/seed-posts',
    '/api/cron/seed-comments',
    '/api/cron/seed-chat',
    '/api/cron/blog-publish-queue',
    '/api/cron/blog-series-assign',
    '/api/cron/blog-seed-comments',
  ],
  // Phase 5: 시스템 작업 (마지막)
  system: [
    '/api/cron/health-check',
    '/api/cron/daily-stats',
    '/api/cron/auto-grade',
    '/api/cron/cleanup',
    '/api/cron/purge-withdrawn-consents',
    '/api/indexnow',                // ⚠️ /api/cron 아님
    '/api/cron/expire-listings',
    '/api/cron/check-price-alerts',
    '/api/cron/portfolio-snapshot',
    '/api/cron/push-apt-deadline',
  ],
};

// 전체 크론 리스트
const ALL_CRONS = [
  ...CRON_GROUPS.data,
  ...CRON_GROUPS.process,
  ...CRON_GROUPS.ai,
  ...CRON_GROUPS.content,
  ...CRON_GROUPS.system,
];

interface CronResult {
  endpoint: string;
  name: string;
  ok: boolean;
  status: number;
  duration: number;
  error?: string;
}

// 크론 이름 추출
const getName = (ep: string) => ep.split('/').pop() || ep;

// 단일 크론 실행
async function runCron(endpoint: string, baseUrl: string, cronSecret: string | undefined): Promise<CronResult> {
  const start = Date.now();
  const name = getName(endpoint);
  
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
      signal: AbortSignal.timeout(120000), // 2분 타임아웃
    });
    
    return {
      endpoint,
      name,
      ok: res.ok,
      status: res.status,
      duration: Date.now() - start,
    };
  } catch (e: unknown) {
    const error = e instanceof Error ? errMsg(e) : 'Unknown error';
    return {
      endpoint,
      name,
      ok: false,
      status: 0,
      duration: Date.now() - start,
      error,
    };
  }
}

// 배치 병렬 실행 (동시 10개)
async function runBatch(
  endpoints: string[],
  baseUrl: string,
  cronSecret: string | undefined,
  batchSize = 10
): Promise<CronResult[]> {
  const results: CronResult[] = [];
  
  for (let i = 0; i < endpoints.length; i += batchSize) {
    const batch = endpoints.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(ep => runCron(ep, baseUrl, cronSecret))
    );
    
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({
          endpoint: batch[j] || '',
          name: getName(batch[j] || ''),
          ok: false,
          status: 0,
          duration: 0,
          error: r.reason?.message || 'Promise rejected',
        });
      }
    }
  }
  
  return results;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. 관리자 인증
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2. 모드 파싱
    const { mode = 'full', failedOnly = [], endpoint = '' } = await req.json();
    
    const requestUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${requestUrl.protocol}//${requestUrl.host}`;
    const cronSecret = process.env.CRON_SECRET;

    let endpoints: string[] = [];
    
    switch (mode) {
      case 'single':
        // 단일 크론 실행
        if (endpoint && typeof endpoint === 'string') endpoints = [endpoint];
        break;
      case 'data':
        endpoints = CRON_GROUPS.data;
        break;
      case 'process':
        endpoints = CRON_GROUPS.process;
        break;
      case 'ai':
        endpoints = CRON_GROUPS.ai;
        break;
      case 'content':
        endpoints = CRON_GROUPS.content;
        break;
      case 'system':
        endpoints = CRON_GROUPS.system;
        break;
      case 'failed':
        // 실패한 것만 재실행
        endpoints = failedOnly.filter((ep: string) => ALL_CRONS.includes(ep));
        break;
      case 'full':
      default:
        endpoints = ALL_CRONS;
        break;
    }

    if (endpoints.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        mode, 
        results: [], 
        summary: { total: 0, success: 0, failed: 0 },
        duration: Date.now() - startTime 
      });
    }

    // 3. 병렬 실행 (10개씩)
    const results = await runBatch(endpoints, baseUrl, cronSecret, 10);

    // 4. 결과 집계
    const success = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    const failedList = results.filter(r => !r.ok).map(r => r.endpoint);
    const totalDuration = Date.now() - startTime;
    const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length);

    // 5. 로그 기록 (eslint-disable-next-line @typescript-eslint/no-explicit-any)
    await (supabase.from('admin_alerts') as any).insert({
      type: 'god_mode',
      severity: failed > 0 ? 'warning' : 'info',
      title: `🚀 GOD MODE: ${success}/${results.length} 성공`,
      message: `모드: ${mode}, 총 ${totalDuration}ms (평균 ${avgDuration}ms/건)`,
      is_read: false,
    });

    return NextResponse.json({
      ok: failed === 0,
      mode,
      summary: {
        total: results.length,
        success,
        failed,
        duration: totalDuration,
        avgDuration,
      },
      results,
      failedList,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: message,
      duration: Date.now() - startTime 
    }, { status: 500 });
  }
}

// GET: 현재 상태 조회
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 최근 크론 상태 조회
    const { data: recentLogs } = await supabase
      .from('cron_logs')
      .select('cron_name, status, started_at, duration_ms, error_message')
      .order('started_at', { ascending: false })
      .limit(200);

    // 크론별 최신 상태 집계
    const cronStatus = new Map<string, { status: string; lastRun: string; duration: number; error?: string }>();
    for (const log of recentLogs || []) {
      if (!cronStatus.has(log.cron_name)) {
        cronStatus.set(log.cron_name, {
          status: log.status,
          lastRun: log.started_at ?? '',
          duration: log.duration_ms || 0,
          error: log.error_message ?? undefined,
        });
      }
    }

    // 건강 상태 계산
    const total = ALL_CRONS.length;
    const healthy = Array.from(cronStatus.values()).filter(s => s.status === 'success').length;
    const failed = Array.from(cronStatus.values()).filter(s => s.status === 'failed' || s.status === 'error').length;
    const stale = total - cronStatus.size; // 실행 기록 없음

    return NextResponse.json({
      ok: true,
      health: {
        total,
        healthy,
        failed,
        stale,
        score: Math.round((healthy / total) * 100),
      },
      cronStatus: Object.fromEntries(cronStatus),
      failedCrons: Array.from(cronStatus.entries())
        .filter(([, s]) => s.status === 'failed' || s.status === 'error')
        .map(([name, s]) => ({ name, ...s })),
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
