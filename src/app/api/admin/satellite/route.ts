/**
 * 세션 141 (2026-04-19): 호스팅어 네트워크 완전 분리
 *
 * 이 라우트는 과거 분양권실전투자/급매물/주린이 3개 위성 사이트 모니터링 용도였음.
 * 호스팅어 119개 사이트 Japanese Keyword Hack 감염 확정 → 카더라와 평판 분리 위해 비활성화.
 *
 * 라우트 유지 (410 Gone) — 삭제 대신 이력 보존.
 * admin UI에서 호출 지점 없음 (orphan route).
 */

import { NextResponse } from 'next/server';

export const maxDuration = 5;

export async function GET() {
  return NextResponse.json(
    { error: 'disabled', reason: 'hostinger_network_severed_2026-04-19' },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'disabled', reason: 'hostinger_network_severed_2026-04-19' },
    { status: 410 },
  );
}
