import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';

/* ⛔ 투표 차단 — /discuss 는 «읽기 전용 아카이브» 다 (Node 판정 2026-08-31).
 * UI 만 닫으면 반쪽이다 — 라우트가 열려 있으면 같은 사실을 UI 와 API 가 «다르게» 안다.
 * ⚠️ 데이터는 그대로다(토픽 35 · 채팅 216 · 투표 2). 폐쇄는 경로의 일이다.
 * 되살리려면 UI 와 이 라우트를 «같은 커밋에서» 함께 열 것. */
export async function POST() {
  return NextResponse.json(
    { error: 'gone', message: '보관된 토론입니다. 새 글·투표·의견은 받지 않습니다.' },
    { status: 410 },
  );
}
