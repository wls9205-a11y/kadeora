/**
 * /api/admin/master/execute-all — 전체 실행 버튼 핸들러
 *
 * 단계별 실행 (대시보드에서 진행률 폴링):
 *  1. DB 마이그레이션 적용 여부 확인 (적용 안 됐으면 즉시 중단 — 수동 SQL 실행 안내)
 *  2. 마스터 킬 해제 확인
 *  3. naver-blog-content 1회 트리거 (큐 채우기)
 *  4. naver-cafe-publish 1회 트리거 (실제 발행)
 *  5. calc-topic-refresh 1회 트리거 (AI 갱신)
 *  6. seo-internal-links 1회 트리거 (블로그 내부링크)
 *  7. indexnow-mass 1회 트리거 (계산기 토픽 + 결과 페이지 색인)
 *  8. cleanup-calc-results 1회 트리거 (만료 정리)
 *
 * 모드:
 *  - dryRun=true : 어떤 작업이 실행될지만 반환
 *  - parallel=true : 가능한 단계는 병렬 (기본 false 안전)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getConfig } from '@/lib/app-config';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface StepResult {
  step: string;
  ok: boolean;
  duration_ms: number;
  result?: any;
  error?: string;
}

const ALL_STEPS = [
  { id: 'check_migrations',     label: 'DB 마이그레이션 확인',         critical: true,  cron: null },
  { id: 'check_master_kill',    label: '마스터 킬 스위치 확인',         critical: true,  cron: null },
  { id: 'check_oauth',          label: '네이버 OAuth 상태 확인',        critical: false, cron: null },
  { id: 'naver_blog_content',   label: '네이버 블로그 변환 콘텐츠 생성', critical: false, cron: '/api/cron/naver-blog-content' },
  { id: 'naver_cafe_publish',   label: '네이버 카페 자동 발행',          critical: false, cron: '/api/cron/naver-cafe-publish' },
  { id: 'calc_topic_refresh',   label: '계산기 토픽 클러스터 AI 갱신',   critical: false, cron: '/api/cron/calc-topic-refresh' },
  { id: 'seo_internal_links',   label: '블로그 내부 링크 보강',          critical: false, cron: '/api/cron/seo-internal-links' },
  { id: 'indexnow_mass',        label: 'IndexNow 일괄 색인 요청',        critical: false, cron: '/api/cron/indexnow-mass' },
  { id: 'cleanup_calc_results', label: '만료 계산기 결과 정리',          critical: false, cron: '/api/cron/cleanup-calc-results' },
];

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun = !!body.dryRun;
  const onlySteps: string[] | null = Array.isArray(body.steps) ? body.steps : null;
  const skipSteps: string[] = Array.isArray(body.skip) ? body.skip : [];

  const stepsToRun = ALL_STEPS.filter(s => {
    if (onlySteps && !onlySteps.includes(s.id)) return false;
    if (skipSteps.includes(s.id)) return false;
    return true;
  });

  if (dryRun) {
    return NextResponse.json({
      mode: 'dryRun',
      steps: stepsToRun.map(s => ({ id: s.id, label: s.label, critical: s.critical, cron: s.cron })),
    });
  }

  // CRON_SECRET 필요 — admin이지만 cron 트리거에는 secret 필요
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET_missing_in_env' }, { status: 500 });
  }

  const sb = getSupabaseAdmin();
  const startedAt = Date.now();
  const results: StepResult[] = [];

  for (const step of stepsToRun) {
    const stepStart = Date.now();
    try {
      let result: any = null;

      if (step.id === 'check_migrations') {
        const tables = ['app_config', 'oauth_tokens', 'calc_results', 'calc_topic_clusters'];
        const checks = await Promise.all(tables.map(async t => {
          try {
            const { error } = await (sb as any).from(t).select('*', { head: true, count: 'exact' }).limit(1);
            return { table: t, ok: !error };
          } catch { return { table: t, ok: false }; }
        }));
        const missing = checks.filter(c => !c.ok).map(c => c.table);
        if (missing.length > 0 && step.critical) {
          results.push({ step: step.id, ok: false, duration_ms: Date.now() - stepStart, error: `tables_missing: ${missing.join(', ')}` });
          // critical 실패 시 중단
          break;
        }
        result = { all_ok: missing.length === 0, missing };

      } else if (step.id === 'check_master_kill') {
        const kill = await getConfig('master_kill', { all_crons_paused: false, all_publishing_paused: false });
        if ((kill.all_crons_paused || kill.all_publishing_paused) && step.critical) {
          results.push({ step: step.id, ok: false, duration_ms: Date.now() - stepStart, error: 'master_kill_active', result: kill });
          break;
        }
        result = kill;

      } else if (step.id === 'check_oauth') {
        const { data } = await (sb as any).from('oauth_tokens')
          .select('provider, access_token, refresh_token_expires_at, last_error')
          .eq('provider', 'naver_cafe').maybeSingle();
        result = {
          configured: !!data?.access_token,
          hasRefreshToken: !!data?.refresh_token_expires_at,
          lastError: data?.last_error,
        };

      } else if (step.cron) {
        // 실제 크론 트리거
        const r = await fetch(`${SITE_URL}${step.cron}`, {
          headers: { 'Authorization': `Bearer ${cronSecret}` },
          // timeout via AbortController
          signal: AbortSignal.timeout(60_000),
        });
        const txt = await r.text();
        try { result = JSON.parse(txt); } catch { result = { raw: txt.slice(0, 300) }; }
        if (!r.ok) {
          results.push({ step: step.id, ok: false, duration_ms: Date.now() - stepStart, error: `http_${r.status}`, result });
          continue;
        }
      }

      results.push({ step: step.id, ok: true, duration_ms: Date.now() - stepStart, result });
    } catch (e: any) {
      results.push({ step: step.id, ok: false, duration_ms: Date.now() - stepStart, error: e?.message?.slice(0, 200) || 'unknown' });
      // critical 실패면 중단
      if (step.critical) break;
    }
  }

  const totalMs = Date.now() - startedAt;
  const okCount = results.filter(r => r.ok).length;
  const failCount = results.length - okCount;

  // 실행 결과를 app_config 에 마지막 실행 정보로 기록 (대시보드에서 표시)
  await (sb as any).from('app_config').upsert({
    namespace: 'master_control',
    key: 'last_execute_all',
    value: {
      timestamp: new Date().toISOString(),
      total_ms: totalMs,
      ok: okCount,
      failed: failCount,
      results: results.map(r => ({ step: r.step, ok: r.ok, ms: r.duration_ms, error: r.error })),
    },
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'namespace,key' });

  return NextResponse.json({
    ok: failCount === 0,
    total_ms: totalMs,
    ok_count: okCount,
    fail_count: failCount,
    results,
  });
}

export async function GET() {
  // 마지막 실행 결과 조회
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('app_config')
    .select('value, updated_at')
    .eq('namespace', 'master_control').eq('key', 'last_execute_all').maybeSingle();
  return NextResponse.json({
    available_steps: ALL_STEPS.map(s => ({ id: s.id, label: s.label, critical: s.critical })),
    last_run: data?.value || null,
    last_run_at: data?.updated_at || null,
  });
}
