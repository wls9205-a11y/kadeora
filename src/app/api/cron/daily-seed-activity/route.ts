/**
 * ⛔ 폐기됨 — daily-seed-activity (2026-08-31 · 피드 영구 폐쇄 5항)
 *
 * ── 무엇이었나 ──
 * 시드 계정이 «평소에도 자연스럽게 활동» 하게 만들던 자다 — 인기 글에 댓글,
 * 가끔 뻘글, 블로그 댓글.
 *
 * ── 왜 «수리» 가 아니라 «제거» 인가 ──
 * ① **한 번도 돈 적이 없다.** vercel.json 0 · pg_cron 0 · cron_logs 0 —
 *    라우트만 있고 어디에도 등재된 적이 없다.
 * ② 그래서 이 파일의 결함(blog_comments 에 «존재하지 않는 열» user_id 로 insert)은
 *    「매일 조용히 실패하는 버그」가 아니라 **한 번도 터진 적 없는 잠재 결함**이었다.
 *    켤 계획이 없는 코드의 버그를 고치는 것은 값을 만들지 않는다.
 * ③ 그리고 켤 계획이 없다 — 시드 정책은 격리·철거 방향으로 확정됐고
 *    (b96c7ff6 A1 시드 격리 · 33ef3821 seed-posts 등록 해제),
 *    2026-08-31 Node 판정으로 잡담 피드가 영구 폐쇄됐다. 시드가 채울 표면이 없다.
 *
 * ⚠️ 실사용자 UGC 는 2026-04-19 주부터 전 표면 0 이었고, 그동안 「살아 있어 보이던」
 *    커뮤니티는 이 계열 시드가 만든 것이었다(b96c7ff6 실측: 최근 30일 인기 글 200건이
 *    «전부» 시드). 그 착시를 끝내는 것이 이 폐기의 목적이다.
 *
 * ⛔ 데이터는 지우지 않았다 — posts·comments·blog_comments 는 그대로다.
 *    폐기는 «경로와 크론» 의 일이지 데이터의 일이 아니다.
 *
 * 되살릴 일이 생기면: ① blog_comments 의 user_id → author_id 부터 고치고
 * ② 시드 정책 판정을 다시 받은 뒤 ③ 스케줄을 «명시적으로» 등재할 것.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      error: 'gone',
      message:
        'daily-seed-activity 는 2026-08-31 에 폐기됐다. 한 번도 스케줄된 적이 없고, ' +
        '시드 정책은 철거 방향으로 확정됐다. 되살리려면 시드 정책 판정을 먼저 받을 것.',
    },
    { status: 410 },
  );
}
