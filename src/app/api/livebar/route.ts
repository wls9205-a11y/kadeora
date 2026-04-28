import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// LiveBar 통합 텍스트 엔드포인트.
// ?page=apt|stock|blog|feed → { text } 또는 빈 객체.
// 실패 시 클라이언트가 skeleton 으로 fallback 하므로 텍스트 없이 200 으로 응답한다.

// s206: 60s default → 10s 로 단축 — 504 가 발생해도 짧게 발생, Vercel function
// pool 점유 최소화. 클라이언트는 catch silent 라 페이지 영향 없음.
export const maxDuration = 10;
export const revalidate = 60;

// s206: 개별 Supabase count 쿼리당 6s timeout. 한 쿼리가 느려도 전체 함수 보호.
// supabase builder 가 thenable 이라 Promise<any> 로 캐스트 후 race.
function withTimeout(p: any, ms = 6000): Promise<any> {
  return Promise.race([
    p as Promise<any>,
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)),
  ]);
}

const PAGES = ['apt', 'stock', 'blog', 'feed'] as const;
type Page = (typeof PAGES)[number];

async function buildText(page: Page): Promise<string | null> {
  const sb = getSupabaseAdmin();

  if (page === 'apt') {
    // s206: count: 'estimated' (planner reltuples 기반) 사용 — 'exact' 는 큰 테이블에서
    // sequential scan 유발해 자주 6s 초과. estimated 는 ms 단위로 즉시 반환.
    const [r1, r2, r3] = await Promise.all([
      withTimeout((sb as any).from('apt_subscriptions').select('id', { count: 'estimated', head: true })),
      withTimeout((sb as any).from('unsold_apts').select('id', { count: 'estimated', head: true }).eq('is_active', true)),
      withTimeout((sb as any).from('apt_sites').select('id', { count: 'estimated', head: true }).eq('is_active', true)),
    ]);
    const total = r3?.count ?? 0;
    const sub = r1?.count ?? 0;
    const unsold = r2?.count ?? 0;
    return `실시간 · ${total.toLocaleString()} 단지 · 청약 ${sub.toLocaleString()}건 · 미분양 ${unsold.toLocaleString()}건`;
  }

  if (page === 'stock') {
    const { count } = await withTimeout((sb as any).from('stock_quotes').select('symbol', { count: 'estimated', head: true }));
    return `LIVE · KOSPI/KOSDAQ/NYSE/NASDAQ ${(count ?? 0).toLocaleString()}종 · 시세 5분 간격`;
  }

  if (page === 'blog') {
    const { count } = await withTimeout((sb as any).from('blog_posts').select('id', { count: 'estimated', head: true }).eq('is_published', true));
    return `블로그 · ${(count ?? 0).toLocaleString()}편 · 매일 업데이트 · 투자 인사이트`;
  }

  if (page === 'feed') {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await withTimeout((sb as any).from('posts').select('id', { count: 'estimated', head: true }).gte('created_at', since));
    return `피드 · 24h ${(count ?? 0).toLocaleString()}건 · 실시간 갱신`;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get('page');
  if (!page || !PAGES.includes(page as Page)) {
    return NextResponse.json({}, { status: 200 });
  }
  try {
    const text = await buildText(page as Page);
    if (!text) return NextResponse.json({}, { status: 200 });
    return NextResponse.json({ text }, { status: 200, headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
