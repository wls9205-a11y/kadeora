/**
 * [FACT-VERIFIER] big_event_registry.fact_confidence_score 일 1회 일괄 갱신
 *
 * - is_active=true 인 모든 이벤트에 대해 computeFactConfidence 실행
 * - 점수 저장 + 최근 변경 요약 리포트
 * - Vercel cron 100건 한계로 pg_cron/수동 트리거 사용 (세션 138 설계)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { refreshAllFactConfidence } from '@/lib/big-event-fact-verify';

export const maxDuration = 120;
export const runtime = 'nodejs';

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('big-event-fact-refresh', async () => {
      const sb = getSupabaseAdmin();
      const result = await refreshAllFactConfidence(sb);

      // 최저 점수 5개 요약 (Node 모니터링용)
      const low = [...result.rows].sort((a, b) => a.score - b.score).slice(0, 5);

      return {
        processed: result.updated + result.failed,
        created: 0,
        updated: result.updated,
        failed: result.failed,
        metadata: {
          low_confidence_samples: low.map((r) => ({ id: r.id, score: r.score, reasons: r.reasons })),
        },
      };
    }, { redisLockTtlSec: 180 }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
