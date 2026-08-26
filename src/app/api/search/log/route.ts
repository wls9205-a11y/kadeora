// ⚠️ **이 라우트는 지금 아무도 부르지 않는다** (2026-08-26 전수 확인 — 호출부 0곳).
//    실제 검색 기록은 `/api/search` 가 `log_search` RPC 로 남긴다.
//    그래서 H4-3 계측의 «본체» 는 그쪽에 있다. 여기는 되살릴 때를 대비해 규약만 맞춰 둔다 —
//    한쪽만 계측되면 4주 뒤 집계가 두 모집단을 섞게 된다.
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { classifyBot } from '@/lib/bot-classify';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const body = await req.json();
    const query = body.query?.trim();
    if (!query) return NextResponse.json({ ok: false });

    const admin = getSupabaseAdmin();
    const ua = req.headers.get('user-agent');
    // ⚠️ 사람도 'human' 문자열을 남긴다. NULL 은 «미계측» 이라는 뜻이다 (bot-classify.ts S10-1).
    const { error } = await admin.from('search_logs').insert({
      user_id: user?.id ?? null,
      query,
      results_count: body.results_count ?? null,
      user_agent: ua,
      bot_type: classifyBot(ua),
    });
    // ⚠️ 삼키지 않는다 — 조용히 실패하면 집계가 빈 채로 4주가 간다.
    if (error) console.error('[/api/search/log] insert failed:', error);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
