import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { classifyBot } from '@/lib/bot-classify';

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { blogId } = await req.json();
    if (!blogId || typeof blogId !== 'string') return NextResponse.json({ error: 'Missing blogId' }, { status: 400 });

    // s274 — 봇 제외. /api/analytics/pageview 는 classifyBot 을 쓰는데 이 라우트만
    // 빠져 있어서 JS 를 실행하는 크롤러(bingbot·Yandex 등)가 그대로 카운트됐다.
    // 그 결과 view_count 가 실제 독자와 완전히 분리됐다 — 예: 레이카운티 글이
    // view_count 6,828 인데 30일 사람 조회는 0. 홈 '인기 블로그' 가 이 값으로
    // 정렬되고 있어서 아무도 안 읽는 글이 인기글로 노출됐다.
    // (이미 누적된 값은 소급 보정하지 않는다 — 사람/봇 구분 이력이 없다.)
    if (classifyBot(req.headers.get('user-agent')) !== 'human') {
      return NextResponse.json({ ok: true, skipped: 'bot' });
    }

    const sb = getSupabaseAdmin();
    await (sb as any).rpc('increment_blog_view', { p_blog_id: blogId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
