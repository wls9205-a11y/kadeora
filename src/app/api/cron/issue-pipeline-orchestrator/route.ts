/**
 * ⛔ 폐기됨 — issue-pipeline-orchestrator (2026-08-31 · BG-1 판정 1)
 *
 * ── 무엇이었나 ──
 * s192 에서 vercel.json crons 100 한도를 피하려고 4 단계(fact-check → image-attach →
 * seo-enrich → publish)를 internal fetch 로 «한 크론에» 묶은 자다.
 *
 * ── 왜 폐기하나 — 두 가지가 «동시에» 참이었다 ──
 * ① **한 번도 작동한 적이 없다.** 3일 287회 전부 `401 Protected deployment`.
 *    base 를 «요청 origin» 에서 잡았는데(아래) pg_cron 은 배포별 URL 로 들어오고
 *    그 호스트에는 Vercel Deployment Protection 이 걸려 있다. 전 스테이지가 401 이었다.
 *
 *      let base = SITE_URL;                          // ← 사문. try 가 «항상» 성공한다
 *      try { const u = new URL(req.url);
 *            base = `${u.protocol}//${u.host}`; }    // ← 보호된 배포 호스트가 들어온다
 *      catch { }
 *
 * ② **그리고 애초에 중복이었다.** 같은 4 단계가 pg_cron 에 «개별로» 등록돼 있고
 *    (jobid 76 fact-check · 77 image-attach · 78 seo-enrich · 79 publish · 각 15분)
 *    그쪽은 정상 가동한다 — 실측에서 publish·image-attach 는 매 실행 20건씩 처리 중이다.
 *
 * ⛔ 그래서 «고치면 안 된다». base 를 SITE_URL 로 고치면 그 순간부터 같은 4 단계가
 *    15분마다 «이중 실행» 된다 — BG-3 이 경고한 중복 기동을 우리 손으로 만드는 셈이다.
 *    고장이면서 중복인 자는 수리 대상이 아니라 폐기 대상이다.
 *
 * ── 집행 ──
 * vercel.json 등록 제거(crons 82 → 81)가 본체다. 이 파일은 «흔적으로» 남긴다 —
 * 지우면 다음 사람이 같은 이유로 다시 만들 수 있고, 410 은 되살아났을 때 «시끄럽게» 실패한다.
 * ⚠️ 되살릴 일이 생기면 먼저 pg_cron jobid 76~79 를 끄고 와야 한다. 순서가 반대면 이중 실행이다.
 *
 * ── 남긴 인벤토리 (수리 아님 · 다음 판정 자료) ──
 * 같은 「origin 우선 base」 패턴이 저장소에 하나 더 있다:
 *   src/app/api/admin/issues/run-pipeline/route.ts:80-83
 * 그쪽은 어드민 화면(kadeora.app)에서 호출되므로 origin 이 곧 운영 도메인이라 «오늘은» 산다.
 * 보호된 프리뷰에서 누르면 같은 401 이 난다 — 잠재 결함으로 등재만 해 둔다.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      error: 'gone',
      message:
        'issue-pipeline-orchestrator 는 2026-08-31 에 폐기됐다. ' +
        '4 단계는 pg_cron 에 개별 등록(jobid 76~79)되어 각자 돈다. ' +
        '되살리기 전에 그 넷을 먼저 끌 것 — 아니면 이중 실행이 된다.',
    },
    { status: 410 },
  );
}
