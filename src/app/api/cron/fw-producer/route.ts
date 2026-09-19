/**
 * FW 생산자 크론 — 옛 issue-preempt 슬롯(8/27 A1 에서 해제)의 전면 신작.
 * 현장 기점 4축 회전으로 issue_alerts(fw_hub) 를 적재한다. 생성·게이트·hold 는 issue-draft 레일 그대로.
 * ⛔ app_config fw.producer_enabled 가 정확히 true 가 아니면 아무것도 적재하지 않는다(off 시작).
 * 정본: docs/bn/BN_CC_reply_20260918.md 15차(세션 A 「지시서_FW_20260919」 골자).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fwSwitch, runRotation } from '@/lib/fw/producer';

export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('fw-producer', async () => {
      const sb = getSupabaseAdmin() as any;
      if (!(await fwSwitch(sb, 'producer_enabled'))) {
        return { processed: 0, metadata: { skipped: 'fw.producer_enabled != true' } };
      }
      const perRun = Math.max(1, Math.min(8, Number(req.nextUrl.searchParams.get('n') ?? '4')));
      const out = await runRotation(sb, perRun);
      const created = Object.values(out).reduce((a, v) => a + v.length, 0);
      return { processed: created, created, metadata: out };
    }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
