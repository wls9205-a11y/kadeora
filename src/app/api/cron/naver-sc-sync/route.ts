/**
 * 세션 146 A2 — 네이버 서치어드바이저 일 1회 동기화.
 * NAVER_SC_API_KEY 미설정 시 200 + skip log.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return new NextResponse('ok', { status: 200 });

  const key = process.env.NAVER_SEARCHADVISOR_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: true, skipped: 'no_naver_sc_key', note: 'docs/NAVER_SC_SETUP.md 참고' });
  }

  // Naver SearchAdvisor API 는 공식 Open API 미제공 — 수동 등록 기반 + 자체 크롤링 경로 필요.
  // 현재는 placeholder, 실제 구현은 NAVER_SC_SETUP.md 완료 후.
  return NextResponse.json({ ok: true, skipped: 'impl_pending', note: 'NAVER_SC_SETUP.md 체크리스트 완료 필요' });
}

export const GET = handler;
export const POST = handler;
