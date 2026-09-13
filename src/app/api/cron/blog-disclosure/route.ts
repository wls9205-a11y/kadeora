/**
 * ⛔ 폐기됨 — blog-disclosure (2026-09-13 · FINAL_HC_20260913 C-4)
 *
 * ── 무엇이었나 ──
 * stock_disclosures 를 «2026-03-01 ~ 03-31 고정 창» 으로 읽어 주간 요약 글(`disclosure-2026-03-w{n}`)을 만들던 자다.
 *
 * ── 왜 «파라미터화» 가 아니라 «묘비» 인가 ──
 * ① 날짜 창이 코드에 박제돼 있어 몇 번을 돌려도 «3월 글을 다시 쓰는» 동작뿐이다.
 * ② 스케줄 4면 전부 0 — vercel.json · pg_cron · workflows 무등재, cron_logs 0행.
 *    유일한 호출자는 god-mode 팬아웃이었고(같은 커밋에서 제거), 산출물은 2026-04-12 1회분
 *    (2편)이 전부다.
 * ③ 소생 계획이 없다. 계획 없이 파라미터화하면 «안 도는 코드를 고치는» 일이 된다
 *    (daily-seed-activity CLOSE 선례).
 *
 * ⛔ 데이터는 지우지 않았다 — 이미 발행된 글은 그대로다.
 * 되살릴 일이 생기면: 날짜 창을 요청 파라미터/실행 시각 기준으로 바꾸고, 스케줄을 «명시적으로» 등재할 것.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      error: 'gone',
      message: 'blog-disclosure 은 2026-09-13 에 폐기됐다. 2026-03 고정 창 박제 · 스케줄 0 · 소생 계획 없음.',
    },
    { status: 410 },
  );
}
