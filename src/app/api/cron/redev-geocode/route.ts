/**
 * ⛔ 퇴역 — redev-geocode (2026-09-13 · HC_CLOSE K-1)
 *
 * ── 무엇이었나 ──
 * 재개발·apt_sites 주소를 카카오 로컬(주소·키워드) → Naver 키워드 3단 폴백으로 좌표화하던 크론.
 * 매일 05:15·17:15 UTC.
 *
 * ── 왜 퇴역인가 (근거 둘) ──
 * ① 카카오 로컬 API 가 2026-08-26 부터 403 SERVICE_DISABLED(OPEN_MAP_AND_LOCAL 꺼짐)이고,
 *    2026-09-13 Node 판정으로 콘솔 복구를 «영구 skip» 했다. 이 크론의 1·2단은 영구히 산출 0.
 * ② 8/26 구조 진단: 남은 대상은 주소 없는 169곳 — 403 과 무관하게 좌표를 만들 수 없는 구조.
 * 결과는 매 회차 maxDuration(180s) 킬 → 완료 기록 없음 → 스위퍼가 15분 뒤 timeout 표기.
 * 일 2×180초가 낭비였다.
 *
 * 4면: vercel.json 스케줄 제거(같은 커밋) · pg_cron 0 · workflows 0 · god-mode 팬아웃 제거(같은 커밋).
 * ⛔ 데이터 무접촉 — 이미 채워진 좌표는 그대로다.
 * 되살릴 일이 생기면: 로컬 API 복구 여부부터 확인하고, 주소 없는 대상의 좌표 출처를 먼저 정할 것.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      error: 'gone',
      message: 'redev-geocode 는 2026-09-13 에 퇴역했다. 카카오 로컬 API 영구 403 · 주소 없는 대상 구조.',
    },
    { status: 410 },
  );
}
