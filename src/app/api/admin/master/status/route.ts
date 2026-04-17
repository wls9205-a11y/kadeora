/**
 * /api/admin/master/status — 카더라 전체 시스템 상태 종합
 *
 * MasterControlTab 에서 읽음. 한 번의 호출로 모든 정보:
 * - DB 마이그레이션 적용 여부 (테이블 존재 체크)
 * - OAuth provider 상태
 * - app_config 마스터 킬 스위치
 * - 크론 실행 통계 (24h)
 * - 네이버 syndication 큐 상태
 * - 계산기 토픽 클러스터 통계
 * - 결제·구독·광고 시스템 상태
 * - 환경변수 누락 체크
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getConfig, listConfig } from '@/lib/app-config';
import { listOAuthProviders } from '@/lib/naver/oauth-store';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface SystemStatus {
  ok: boolean;
  warning?: string;
  error?: string;
  detail?: any;
}

async function check<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 200) || 'unknown' };
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const sb = getSupabaseAdmin();

  // ── 1. DB 마이그레이션 적용 여부 ──
  const dbChecks = await Promise.allSettled([
    (sb as any).from('app_config').select('namespace', { head: true, count: 'exact' }).limit(1),
    (sb as any).from('oauth_tokens').select('provider', { head: true, count: 'exact' }).limit(1),
    (sb as any).from('calc_results').select('short_id', { head: true, count: 'exact' }).limit(1),
    (sb as any).from('calc_topic_clusters').select('topic_slug', { head: true, count: 'exact' }).limit(1),
  ]);
  const tables = ['app_config', 'oauth_tokens', 'calc_results', 'calc_topic_clusters'];
  const migrations: Record<string, SystemStatus> = {};
  dbChecks.forEach((r, i) => {
    if (r.status === 'fulfilled' && !r.value.error) {
      migrations[tables[i]] = { ok: true, detail: { count: r.value.count ?? 0 } };
    } else {
      migrations[tables[i]] = { ok: false, error: 'table_missing_or_no_access' };
    }
  });
  const migrationsApplied = Object.values(migrations).every(m => m.ok);

  // ── 2. 마스터 킬 스위치 ──
  const masterKill = await getConfig('master_kill', {
    all_crons_paused: false,
    all_publishing_paused: false,
  });

  // ── 3. OAuth 상태 ──
  const oauthRes = migrationsApplied
    ? await check(() => listOAuthProviders())
    : { ok: false as const, error: 'oauth_tokens_table_missing' };
  const oauth = oauthRes.ok ? oauthRes.data : [];

  // ── 4. 네이버 syndication 큐 ──
  const synRes = await check(async () => {
    const { data: items } = await (sb as any).from('naver_syndication')
      .select('blog_status, cafe_status').limit(500);
    const arr = items || [];
    return {
      total: arr.length,
      cafe_pending: arr.filter((i: any) => i.cafe_status === 'pending').length,
      cafe_published: arr.filter((i: any) => i.cafe_status === 'published').length,
      cafe_failed: arr.filter((i: any) => i.cafe_status === 'failed').length,
      blog_pending: arr.filter((i: any) => i.blog_status === 'pending').length,
      blog_published: arr.filter((i: any) => i.blog_status === 'published').length,
    };
  });

  // ── 5. 계산기 토픽 클러스터 통계 ──
  const calcTopicsRes = migrationsApplied ? await check(async () => {
    const { data: topics } = await (sb as any).from('calc_topic_clusters')
      .select('topic_slug, intro_html, last_refreshed_at, blog_post_ids, search_volume_naver');
    const arr = topics || [];
    return {
      total: arr.length,
      with_intro: arr.filter((t: any) => !!t.intro_html).length,
      with_blogs: arr.filter((t: any) => Array.isArray(t.blog_post_ids) && t.blog_post_ids.length > 0).length,
      stale_30d: arr.filter((t: any) => !t.last_refreshed_at || (Date.now() - new Date(t.last_refreshed_at).getTime() > 30 * 86400 * 1000)).length,
      total_search_volume: arr.reduce((s: number, t: any) => s + (t.search_volume_naver || 0), 0),
    };
  }) : { ok: false as const, error: 'calc_topic_clusters_table_missing' };

  // ── 6. 계산기 결과 통계 ──
  const calcResultsRes = migrationsApplied ? await check(async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: total } = await (sb as any).from('calc_results').select('short_id', { count: 'exact', head: true });
    const { count: today_count } = await (sb as any).from('calc_results')
      .select('short_id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    const { count: popular } = await (sb as any).from('calc_results')
      .select('short_id', { count: 'exact', head: true })
      .gt('view_count', 5)
      .gt('expires_at', new Date().toISOString());
    return { total: total || 0, today: today_count || 0, indexable: popular || 0 };
  }) : { ok: false as const, error: 'calc_results_table_missing' };

  // ── 7. 크론 24시간 통계 ──
  const cronRes = await check(async () => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: logs } = await (sb as any).from('cron_logs')
      .select('cron_name, status').gte('started_at', since);
    const arr = logs || [];
    const byCron: Record<string, { success: number; failed: number; running: number }> = {};
    for (const log of arr) {
      if (!byCron[log.cron_name]) byCron[log.cron_name] = { success: 0, failed: 0, running: 0 };
      if (log.status === 'success') byCron[log.cron_name].success++;
      else if (log.status === 'failed') byCron[log.cron_name].failed++;
      else if (log.status === 'running') byCron[log.cron_name].running++;
    }
    const totalSuccess = arr.filter((l: any) => l.status === 'success').length;
    const totalFailed = arr.filter((l: any) => l.status === 'failed').length;
    const stuckRunning = arr.filter((l: any) => l.status === 'running').length;
    const successRate = totalSuccess + totalFailed > 0
      ? Math.round((totalSuccess / (totalSuccess + totalFailed)) * 100)
      : 100;
    return {
      total: arr.length,
      success: totalSuccess,
      failed: totalFailed,
      stuck_running: stuckRunning,
      success_rate: successRate,
      worst: Object.entries(byCron)
        .filter(([_, s]) => s.failed > 0)
        .sort((a, b) => b[1].failed - a[1].failed)
        .slice(0, 5)
        .map(([name, s]) => ({ name, ...s })),
    };
  });

  // ── 8. 환경변수 누락 체크 ──
  const requiredEnvs = [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET', 'ANTHROPIC_API_KEY', 'INDEXNOW_KEY',
    'NEXT_PUBLIC_KAKAO_JS_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY',
    'NEXT_PUBLIC_TOSS_CLIENT_KEY', 'TOSS_SECRET_KEY',
    'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET',
  ];
  const envStatus: Record<string, boolean> = {};
  for (const k of requiredEnvs) envStatus[k] = !!process.env[k];
  const envMissing = requiredEnvs.filter(k => !process.env[k]);

  // ── 9. 전체 app_config 노출 ──
  const allConfigRes = await check(() => listConfig());
  const allConfig = allConfigRes.ok ? allConfigRes.data : {};

  // ── 9.5. KPI 대시보드 (get_admin_dashboard RPC — SECURITY DEFINER + EXCEPTION 핸들러 내장) ──
  // health/kpi_7d/kpi_30d/funnel_7d/top_pages_24h/retention_tools/cron_recent_failures 통합 반환
  const dashboardRes = await check(async () => {
    const { data, error } = await (sb as any).rpc('get_admin_dashboard');
    if (error) throw error;
    return data;
  });
  const dashboard = dashboardRes.ok ? dashboardRes.data : null;

  // ── 10. 헬스 점수 ──
  let healthScore = 100;
  if (!migrationsApplied) healthScore -= 30;
  if (!cronRes.ok || (cronRes.ok && cronRes.data.success_rate < 90)) healthScore -= 20;
  if (envMissing.length > 5) healthScore -= 15;
  if (masterKill.all_crons_paused || masterKill.all_publishing_paused) healthScore -= 25;
  if (!oauth.find((p: any) => p.provider === 'naver_cafe')?.configured) healthScore -= 10;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    site_url: SITE_URL,
    health_score: Math.max(0, healthScore),
    master_kill: masterKill,
    migrations: { applied: migrationsApplied, tables: migrations },
    oauth_providers: oauth,
    naver_syndication: synRes.ok ? synRes.data : { error: synRes.error },
    calc_topics: calcTopicsRes.ok ? calcTopicsRes.data : { error: calcTopicsRes.error },
    calc_results: calcResultsRes.ok ? calcResultsRes.data : { error: calcResultsRes.error },
    crons_24h: cronRes.ok ? cronRes.data : { error: cronRes.error },
    env: { ok: envMissing.length === 0, missing: envMissing, status: envStatus },
    app_config: allConfig,
    dashboard,
    next_actions: deriveNextActions({
      migrationsApplied, masterKill, oauth, envMissing,
      synStats: synRes.ok ? synRes.data : null,
      calcTopics: calcTopicsRes.ok ? calcTopicsRes.data : null,
      calcResults: calcResultsRes.ok ? calcResultsRes.data : null,
      cron: cronRes.ok ? cronRes.data : null,
    }),
  });
}

function deriveNextActions(s: any): Array<{ priority: 'high' | 'medium' | 'low'; action: string; detail?: string }> {
  const actions: Array<{ priority: 'high' | 'medium' | 'low'; action: string; detail?: string }> = [];

  if (!s.migrationsApplied) {
    actions.push({ priority: 'high', action: 'DB 마이그레이션 4개를 Supabase Dashboard 에서 실행', detail: 'docs/migrations/20260417_*.sql' });
  }

  if (s.masterKill.all_crons_paused) {
    actions.push({ priority: 'high', action: '⚠️ 마스터 킬 (all_crons_paused) 켜져있음 — 끄거나 의도된 상태인지 확인' });
  }
  if (s.masterKill.all_publishing_paused) {
    actions.push({ priority: 'high', action: '⚠️ 마스터 킬 (all_publishing_paused) 켜져있음 — 외부 발행 정지 상태' });
  }

  const naverCafe = (s.oauth || []).find((p: any) => p.provider === 'naver_cafe');
  if (!naverCafe || !naverCafe.configured) {
    actions.push({ priority: 'high', action: '네이버 카페 OAuth 미등록 — NaverPublishTab에서 등록 필요' });
  } else if (naverCafe.daysUntilRefreshExpiry !== null && naverCafe.daysUntilRefreshExpiry < 30) {
    actions.push({ priority: 'high', action: `네이버 카페 refresh_token 곧 만료 (${naverCafe.daysUntilRefreshExpiry}일 남음) — 갱신 필요` });
  }

  if (s.envMissing && s.envMissing.length > 0) {
    if (s.envMissing.includes('TOSS_SECRET_KEY')) {
      actions.push({ priority: 'high', action: 'TOSS_SECRET_KEY 미설정 — 결제 작동 안 함' });
    }
    if (s.envMissing.includes('ANTHROPIC_API_KEY')) {
      actions.push({ priority: 'high', action: 'ANTHROPIC_API_KEY 미설정 — AI 콘텐츠 생성 정지' });
    }
    if (s.envMissing.length > 0) {
      actions.push({ priority: 'medium', action: `환경변수 ${s.envMissing.length}개 미설정`, detail: s.envMissing.join(', ') });
    }
  }

  if (s.cron && s.cron.success_rate < 90) {
    actions.push({ priority: 'high', action: `크론 성공률 저조 (${s.cron.success_rate}%)`, detail: '하단 worst 목록 확인' });
  }
  if (s.cron && s.cron.stuck_running > 5) {
    actions.push({ priority: 'medium', action: `크론 'running' 좀비 ${s.cron.stuck_running}건 — cron_logs reconciliation 필요` });
  }

  if (s.synStats && s.synStats.cafe_failed > 5) {
    actions.push({ priority: 'medium', action: `네이버 카페 실패 ${s.synStats.cafe_failed}건 — 재시도 또는 에러 확인` });
  }

  if (s.calcTopics && s.calcTopics.total > 0 && s.calcTopics.with_intro < s.calcTopics.total / 2) {
    actions.push({ priority: 'medium', action: `계산기 토픽 중 AI 도입부 누락 ${s.calcTopics.total - s.calcTopics.with_intro}/${s.calcTopics.total}건 — calc-topic-refresh 트리거` });
  }

  return actions;
}
