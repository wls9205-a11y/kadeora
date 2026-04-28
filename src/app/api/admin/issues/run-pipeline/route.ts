/**
 * /api/admin/issues/run-pipeline — CI-v1 Phase 2 4 cron 강제 실행 (관리자 디버그 용).
 *
 *  s191: cron 사이클 (15/30분) 안 기다리고 즉시 fact-check → image-attach →
 *  seo-enrich → publish 4 단계 internal fetch. 각 단계 결과 수집 후 jsonb 반환.
 *
 *  보안: requireAdmin (profiles.is_admin) + Bearer CRON_SECRET 자체 호출.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const STEPS = [
  '/api/cron/issue-fact-check',
  '/api/cron/issue-image-attach',
  '/api/cron/issue-seo-enrich',
  '/api/cron/issue-publish',
] as const;

interface StepResult {
  step: string;
  status: number;
  ok: boolean;
  duration_ms: number;
  body?: any;
  error?: string;
}

async function runStep(path: string, base: string, secret: string): Promise<StepResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      // 단계당 최대 250s — 전체 maxDuration=300 이내 4단계 안전.
      signal: AbortSignal.timeout(250_000),
    });
    const duration_ms = Date.now() - start;
    let body: any = null;
    try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
    return {
      step: path,
      status: res.status,
      ok: res.ok,
      duration_ms,
      body,
    };
  } catch (e: any) {
    return {
      step: path,
      status: 0,
      ok: false,
      duration_ms: Date.now() - start,
      error: e?.message || String(e),
    };
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET 환경변수 누락 — Vercel env 에 설정 필요' },
      { status: 500 },
    );
  }

  // base url: 우선 요청 origin, fallback SITE_URL.
  let base = SITE_URL;
  try {
    const u = new URL(req.url);
    base = `${u.protocol}//${u.host}`;
  } catch { /* fallback */ }

  const results: StepResult[] = [];
  for (const step of STEPS) {
    const r = await runStep(step, base, secret);
    results.push(r);
    // 어느 단계든 실패해도 다음 단계는 진행 (멱등 cron 이라 안전).
  }

  const summary = {
    started_at: new Date().toISOString(),
    base,
    steps: results.map(r => ({
      step: r.step,
      status: r.status,
      ok: r.ok,
      duration_ms: r.duration_ms,
      processed: r.body?.processed,
      created: r.body?.created,
      updated: r.body?.updated,
      failed: r.body?.failed,
      metadata: r.body?.metadata,
      error: r.error,
    })),
    total_duration_ms: results.reduce((a, b) => a + b.duration_ms, 0),
  };

  return NextResponse.json(summary);
}

// GET 으로 호출되면 안내 메시지 — 외부 노출 시도 방어 + 디버그 도움말.
export async function GET() {
  return NextResponse.json(
    {
      hint: 'POST /api/admin/issues/run-pipeline (admin only)',
      steps: STEPS,
      sequence: 'fact-check → image-attach → seo-enrich → publish',
    },
    { status: 405 },
  );
}
