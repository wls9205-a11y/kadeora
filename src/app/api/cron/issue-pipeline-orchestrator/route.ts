/**
 * [CI-v1 Phase 2] issue-pipeline-orchestrator — 4 단계 파이프라인 1 cron 통합 실행.
 *
 *  s192: vercel.json crons 100 한도 초과 → 4개 entry 를 1개로 합침.
 *  fact-check → image-attach → seo-enrich → publish 를 internal fetch 로 순차 호출.
 *  각 단계 best-effort: 실패해도 다음 단계 진행 (멱등 cron 이라 안전).
 *
 *  보안: withCronAuth (CRON_SECRET / x-vercel-cron / pg_cron 헤더). 자체 호출 시
 *  Bearer CRON_SECRET 사용.
 *
 *  스케줄: every 15min  (4 단계 직렬, max 240s + 50s 여유 < 290s)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 290;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Stage {
  path: string;
  timeoutMs: number;
}

const STAGES: Stage[] = [
  { path: '/api/cron/issue-fact-check',   timeoutMs: 60_000 },
  { path: '/api/cron/issue-image-attach', timeoutMs: 80_000 },
  { path: '/api/cron/issue-seo-enrich',   timeoutMs: 50_000 },
  { path: '/api/cron/issue-publish',      timeoutMs: 50_000 },
];

interface StageResult {
  step: string;
  status: number;
  ok: boolean;
  duration_ms: number;
  body_preview?: string;
  processed?: number;
  created?: number;
  failed?: number;
  error?: string;
}

async function callStage(base: string, secret: string, stage: Stage): Promise<StageResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), stage.timeoutMs);
  try {
    const res = await fetch(`${base}${stage.path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
    });
    const duration_ms = Date.now() - start;
    let body: any = null;
    try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
    const preview = typeof body === 'string'
      ? body.slice(0, 500)
      : JSON.stringify(body || {}).slice(0, 500);
    return {
      step: stage.path,
      status: res.status,
      ok: res.ok,
      duration_ms,
      body_preview: preview,
      processed: body?.processed,
      created: body?.created,
      failed: body?.failed,
    };
  } catch (e: any) {
    return {
      step: stage.path,
      status: 0,
      ok: false,
      duration_ms: Date.now() - start,
      error: e?.name === 'AbortError' ? `timeout_${stage.timeoutMs}ms` : (e?.message || String(e)),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function handler(req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('issue-pipeline-orchestrator', async () => {
      const start = Date.now();

      const secret = process.env.CRON_SECRET;
      if (!secret) {
        return {
          processed: 0,
          failed: 1,
          metadata: { error: 'CRON_SECRET missing', stages: [] },
        };
      }

      // base url: 요청 origin 우선, fallback SITE_URL
      let base = SITE_URL;
      try {
        const u = new URL(req.url);
        base = `${u.protocol}//${u.host}`;
      } catch { /* fallback */ }

      const stages: StageResult[] = [];
      let totalProcessed = 0;
      let totalCreated = 0;
      let totalFailed = 0;

      for (const stage of STAGES) {
        const r = await callStage(base, secret, stage);
        stages.push(r);
        totalProcessed += r.processed || 0;
        totalCreated += r.created || 0;
        totalFailed += r.failed || 0;
        // best-effort: 실패해도 다음 단계 진행
      }

      return {
        processed: totalProcessed,
        created: totalCreated,
        failed: totalFailed,
        metadata: {
          base,
          stages: stages.map(s => ({
            step: s.step,
            status: s.status,
            ok: s.ok,
            duration_ms: s.duration_ms,
            processed: s.processed,
            created: s.created,
            failed: s.failed,
            error: s.error,
            body_preview: s.body_preview,
          })),
          total_duration_ms: Date.now() - start,
        },
      };
    }, { redisLockTtlSec: 270 }),
  );
}

export const GET = withCronAuth(handler);
export const POST = withCronAuth(handler);
