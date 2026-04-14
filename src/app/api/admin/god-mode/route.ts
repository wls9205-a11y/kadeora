import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';

export const maxDuration = 300; // 5분

/* ═══════════════════════════════════════════════════════════
   🚀 GOD MODE API v2 — Phase 순차 + Fire-and-Forget
   POST /api/admin/god-mode
   body: { mode: 'full' | 'data' | 'process' | 'ai' | 'content' | 'system' | 'failed' | 'single' }
   
   full 모드 실행 전략:
   - Phase 1~2 (data/process): 병렬 + 응답 대기 (30s)
   - Phase 3~4 (ai/content): Fire-and-Forget (요청만 보내고 응답 안 기다림)
   - Phase 5 (system): 병렬 + 응답 대기 (30s)
   
   이유: Sonnet 크론은 180s 소요 → 300s GOD MODE 안에 대기 불가
   cron_logs DB에 결과가 기록되므로 응답 대기 불필요
═══════════════════════════════════════════════════════════ */

const CRON_GROUPS = {
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
    '/api/cron/stock-crawl',
    '/api/cron/stock-discover',
    '/api/cron/stock-price',
    '/api/cron/exchange-rate',
    '/api/cron/stock-news-crawl',
    '/api/cron/stock-flow-crawl',
    '/api/cron/invest-calendar-refresh',
    '/api/cron/crawl-apt-rent',
    '/api/cron/issue-detect',
    '/api/cron/issue-trend',
    '/api/cron/issue-preempt',
    // 세션 108 추가
    '/api/cron/collect-site-images',
    '/api/cron/collect-complex-images',
    '/api/cron/collect-site-facilities',
    '/api/cron/collect-site-trends',
    '/api/cron/apt-image-crawl',
    '/api/cron/kapt-sync',
    '/api/cron/naver-blog-content',
    '/api/cron/health-check',
  ],
  process: [
    '/api/cron/aggregate-trade-stats',
    '/api/cron/sync-apt-sites',
    '/api/cron/sync-complex-profiles',
    '/api/cron/stock-theme-daily',
    '/api/cron/redev-geocode',
    '/api/cron/apt-backfill-details',
    '/api/cron/apt-parse-announcement',
    '/api/cron/apt-parse-pdf-pricing',
    '/api/cron/apt-crawl-pricing',
    '/api/cron/apt-price-sync',
    '/api/cron/auto-verify-households',
    '/api/cron/naver-complex-sync',
    // 세션 108 추가
    '/api/cron/apt-price-change',
    '/api/cron/redev-enrich',
    '/api/cron/redev-verify-households',
    '/api/cron/daily-report-snapshot',
  ],
  ai: [
    '/api/cron/apt-ai-summary',
    '/api/cron/apt-analysis-gen',
    '/api/cron/stock-daily-briefing',
    '/api/cron/stock-analysis-gen',
    '/api/cron/stock-desc-gen',
    '/api/cron/blog-rewrite',
    '/api/cron/batch-rewrite-submit',
    '/api/cron/batch-rewrite-poll',
    '/api/cron/batch-analysis-submit',
    '/api/cron/batch-analysis-poll',
    '/api/cron/issue-draft',
    // 세션 108 추가
    '/api/cron/blog-enrich-rewrite',
    '/api/cron/blog-generate-images',
    '/api/cron/post-ai-summary',
  ],
  content: [
    '/api/cron/seed-posts',
    '/api/cron/blog-publish-queue',
    '/api/cron/blog-series-assign',
    '/api/cron/blog-stock-v2',
    '/api/cron/blog-apt-v2',
    '/api/cron/blog-weekly-market',
    '/api/cron/blog-monthly-market',
    '/api/cron/blog-trade-analysis',
    '/api/cron/blog-stock-deep',
    '/api/cron/blog-etf-compare',
    '/api/cron/blog-adr-compare',
    '/api/cron/blog-sector-rotation',
    '/api/cron/blog-subscription-strategy',
    '/api/cron/blog-quality-prune',
    '/api/cron/blog-restore-candidate',
    '/api/cron/blog-restore-monitor',
    '/api/cron/analysis-refresh',
    '/api/cron/stock-fundamentals-kr',
    '/api/cron/stock-fundamentals-us',
    '/api/cron/data-quality-monitor',
    '/api/cron/apt-enrich-location',
    '/api/cron/batch-cluster-submit',
    '/api/cron/batch-cluster-poll',
    '/api/cron/seo-score-refresh',
    '/api/cron/feed-buzz-publish',
    '/api/cron/daily-seed-activity',
    '/api/cron/aggregate-user-events',
    '/api/cron/blog-builder-analysis',
    '/api/cron/blog-calculator-guide',
    '/api/cron/blog-comparison',
    '/api/cron/blog-competition-rate',
    '/api/cron/blog-disclosure',
    '/api/cron/blog-district-guide',
    '/api/cron/blog-dividend-etf',
    '/api/cron/blog-exchange-rate',
    '/api/cron/blog-investor-flow',
    '/api/cron/blog-life-guide',
    '/api/cron/blog-loan-guide',
    '/api/cron/blog-market-pulse',
    '/api/cron/blog-regional-analysis',
    '/api/cron/blog-subscription-monthly',
    '/api/cron/blog-tax-guide',
    '/api/cron/blog-theme-stocks',
    '/api/cron/blog-trade-trend',
    '/api/cron/blog-unsold-trend',
    '/api/cron/blog-weekly-digest',
    // 세션 108 추가
    '/api/cron/blog-apt-landmark',
    '/api/cron/blog-invest-calendar',
    '/api/cron/blog-redev-summary',
    '/api/cron/blog-upcoming-projects',
    '/api/cron/blog-cleanup-padding',
    '/api/cron/blog-data-update',
    '/api/cron/naver-cafe-publish',
    '/api/cron/seed-chat',
    '/api/cron/seed-comments',
  ],
  system: [
    '/api/cron/daily-stats',
    '/api/cron/auto-grade',
    '/api/cron/cleanup',
    '/api/cron/cleanup-pageviews',
    '/api/cron/purge-withdrawn-consents',
    '/api/cron/refresh-trending',
    '/api/cron/refresh-mv',
    '/api/cron/push-apt-deadline',
    '/api/cron/push-content-alert',
    '/api/cron/push-daily-reminder',
    '/api/cron/check-price-alerts',
    '/api/cron/indexnow-mass',
    '/api/cron/indexnow-new-content',
    '/api/cron/indexnow-full-sweep',
    '/api/cron/blog-internal-links',
    '/api/cron/stock-naver-sync',
    '/api/cron/seo-excerpt-fill',
    '/api/cron/seo-title-optimize',
    '/api/cron/seo-indexnow-submit',
    '/api/cron/seo-content-boost',
    '/api/cron/seo-internal-links',
    '/api/cron/blog-subscription-alert',
    '/api/cron/welcome-nudge',
    '/api/cron/blog-fix-existing',
    '/api/cron/price-change-calc',
    '/api/cron/monthly-market-report',
    '/api/cron/blog-complex-crosslink',
    '/api/cron/data-quality-fix',
    // 세션 108 추가
    '/api/cron/email-scheduler',
    '/api/cron/email-digest',
    '/api/cron/daily-reset',
    '/api/cron/expire-listings',
    '/api/cron/churn-prevention',
    '/api/cron/invite-reward',
    '/api/cron/portfolio-snapshot',
    '/api/cron/predict-check',
    '/api/cron/premium-expire',
    '/api/cron/streak-alert',
  ],
};

const ALL_CRONS = [
  ...CRON_GROUPS.data,
  ...CRON_GROUPS.process,
  ...CRON_GROUPS.ai,
  ...CRON_GROUPS.content,
  ...CRON_GROUPS.system,
];

// Fire-and-forget 대상 phase (Sonnet AI 호출 → 180s+ 소요)
const FIRE_AND_FORGET_PHASES = new Set(['data', 'process', 'ai', 'content', 'system']);

interface CronResult {
  endpoint: string;
  name: string;
  ok: boolean;
  status: number;
  duration: number;
  phase: string;
  error?: string;
}

const getName = (ep: string) => ep.split('/').pop() || ep;

// 단일 크론 실행 (응답 대기)
async function runCron(
  endpoint: string, baseUrl: string, cronSecret: string | undefined, 
  timeoutMs: number, phase: string
): Promise<CronResult> {
  const start = Date.now();
  const name = getName(endpoint);
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { endpoint, name, ok: res.ok, status: res.status, duration: Date.now() - start, phase };
  } catch (e: unknown) {
    return { endpoint, name, ok: false, status: 0, duration: Date.now() - start, phase, error: errMsg(e) };
  }
}

// Fire-and-forget: 요청만 보내고 즉시 반환 (Vercel 함수는 백그라운드 실행)
function fireAndForget(
  endpoint: string, baseUrl: string, cronSecret: string | undefined, phase: string
): CronResult {
  // fetch를 보내되 await 하지 않음 — Vercel serverless는 caller와 독립 실행
  fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
  }).catch(() => { /* fire-and-forget: 에러 무시 */ });

  return {
    endpoint,
    name: getName(endpoint),
    ok: true,
    status: 202, // Accepted (dispatched)
    duration: 0,
    phase,
  };
}

// Phase별 타임아웃 설정
const PHASE_TIMEOUTS: Record<string, number> = {
  data: 180000,    // 180s — stock-refresh 최대 300s이지만 대부분 120s 내 완료
  process: 120000, // 120s — geocode, pricing 등 오래 걸림
  ai: 0,           // fire-and-forget
  content: 0,      // fire-and-forget
  system: 45000,   // 45s — 내부 작업
};

// Phase 실행 (대기 또는 fire-and-forget)
async function runPhase(
  phaseName: string,
  endpoints: string[],
  baseUrl: string,
  cronSecret: string | undefined,
  isFireAndForget: boolean,
): Promise<CronResult[]> {
  if (isFireAndForget) {
    // Fire-and-forget: 모든 요청을 즉시 발사
    return endpoints.map(ep => fireAndForget(ep, baseUrl, cronSecret, phaseName));
  }

  // 대기 모드: 배치 병렬 (20개씩)
  const results: CronResult[] = [];
  const timeoutMs = PHASE_TIMEOUTS[phaseName] || 45000;
  const batchSize = 20;

  for (let i = 0; i < endpoints.length; i += batchSize) {
    const batch = endpoints.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(ep => runCron(ep, baseUrl, cronSecret, timeoutMs, phaseName))
    );
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({
          endpoint: batch[j] || '', name: getName(batch[j] || ''),
          ok: false, status: 0, duration: 0, phase: phaseName,
          error: r.reason?.message || 'Promise rejected',
        });
      }
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const startTime = Date.now();

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { mode = 'full', failedOnly = [], endpoint = '' } = await req.json();
    const requestUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${requestUrl.protocol}//${requestUrl.host}`;
    const cronSecret = process.env.CRON_SECRET;

    let allResults: CronResult[] = [];

    if (mode === 'single' && endpoint) {
      // 단일 크론
      const result = await runCron(endpoint, baseUrl, cronSecret, 290000, 'single');
      allResults = [result];
    } else if (mode === 'failed' && failedOnly.length > 0) {
      // 실패 재시도
      const valid = failedOnly.filter((ep: string) => ALL_CRONS.includes(ep));
      const results = await Promise.allSettled(
        valid.map((ep: string) => runCron(ep, baseUrl, cronSecret, 120000, 'retry'))
      );
      allResults = results.map((r, i) =>
        r.status === 'fulfilled' ? r.value : {
          endpoint: valid[i], name: getName(valid[i]),
          ok: false, status: 0, duration: 0, phase: 'retry',
          error: r.reason?.message,
        }
      );
    } else if (mode === 'full') {
      // ★ 전체 실행: Phase 순차 (data→process→[ai+content fire]→system)
      const phases: [string, string[]][] = [
        ['data', CRON_GROUPS.data],
        ['process', CRON_GROUPS.process],
        ['ai', CRON_GROUPS.ai],
        ['content', CRON_GROUPS.content],
        ['system', CRON_GROUPS.system],
      ];

      for (const [phaseName, endpoints] of phases) {
        const isFF = FIRE_AND_FORGET_PHASES.has(phaseName);
        const results = await runPhase(phaseName, endpoints, baseUrl, cronSecret, isFF);
        allResults.push(...results);
      }
    } else {
      // 개별 phase
      const phaseEndpoints = CRON_GROUPS[mode as keyof typeof CRON_GROUPS];
      if (phaseEndpoints) {
        const isFF = FIRE_AND_FORGET_PHASES.has(mode);
        allResults = await runPhase(mode, phaseEndpoints, baseUrl, cronSecret, isFF);
      }
    }

    const success = allResults.filter(r => r.ok).length;
    let failed = allResults.filter(r => !r.ok).length;
    const dispatched = allResults.filter(r => r.status === 202).length;
    let failedList = allResults.filter(r => !r.ok).map(r => r.endpoint);

    // ★ 자동 재시도: full 모드에서 실패한 크론 1회 재시도
    let retryResults: CronResult[] = [];
    if (mode === 'full' && failedList.length > 0 && failedList.length <= 10) {
      await new Promise(r => setTimeout(r, 2000)); // 2초 쿨다운
      const retryPromises = failedList
        .filter(ep => !FIRE_AND_FORGET_PHASES.has(ep)) // fire-and-forget은 재시도 불필요
        .map(ep => runCron(ep, baseUrl, cronSecret, 120000, 'retry'));
      const settled = await Promise.allSettled(retryPromises);
      retryResults = settled.map((r, i) => 
        r.status === 'fulfilled' ? r.value : { endpoint: failedList[i], name: '', ok: false, status: 0, duration: 0, phase: 'retry', error: r.reason?.message }
      );
      const retrySuccess = retryResults.filter(r => r.ok).length;
      if (retrySuccess > 0) {
        failed -= retrySuccess;
        failedList = failedList.filter(ep => !retryResults.find(r => r.endpoint === ep && r.ok));
      }
    }

    const totalDuration = Date.now() - startTime;

    // 로그 기록
    try {
      await supabase.from('admin_alerts').insert({
        type: 'god_mode',
        severity: failed > 0 ? 'warning' : 'info',
        title: `🚀 GOD MODE: ${success}/${allResults.length} (${dispatched} dispatched)`,
        message: `모드: ${mode}, 총 ${totalDuration}ms`,
        is_read: false,
      });
    } catch { /* 로그 실패 무시 */ }

    return NextResponse.json({
      ok: failed === 0,
      mode,
      summary: {
        total: allResults.length,
        success,
        failed,
        dispatched,
        retried: retryResults.length,
        retrySuccess: retryResults.filter(r => r.ok).length,
        duration: totalDuration,
      },
      results: allResults,
      retryResults: retryResults.length > 0 ? retryResults : undefined,
      failedList,
    });

  } catch (error: unknown) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

// GET: 현재 상태 조회
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: recentLogs } = await supabase
      .from('cron_logs')
      .select('cron_name, status, started_at, duration_ms, error_message')
      .order('started_at', { ascending: false })
      .limit(200);

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

    const total = ALL_CRONS.length;
    const healthy = Array.from(cronStatus.values()).filter(s => s.status === 'success').length;
    const failed = Array.from(cronStatus.values()).filter(s => s.status === 'failed' || s.status === 'error').length;
    const stale = total - cronStatus.size;

    return NextResponse.json({
      ok: true,
      health: { total, healthy, failed, stale, score: Math.round((healthy / total) * 100) },
      cronStatus: Object.fromEntries(cronStatus),
      failedCrons: Array.from(cronStatus.entries())
        .filter(([, s]) => s.status === 'failed' || s.status === 'error')
        .map(([name, s]) => ({ name, ...s })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
