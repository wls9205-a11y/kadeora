// src/app/api/search/route.ts — s260
// 단일 검색 API: GET /api/search?q=강남&limit=5
// → search_kadeora_unified_v3 RPC (181ms 안에 9 도메인 처리)
// → log_search RPC 로 검색어 기록 (백그라운드)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";
import { classifyBot } from "@/lib/bot-classify";

export const dynamic = "force-dynamic";
export const maxDuration = 10;
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitRaw || "5", 10), 1), 10);

  if (!q || q.length < 1) {
    return NextResponse.json(
      { query: "", total: 0, error: "empty_query" },
      { status: 200 },
    );
  }
  if (q.length > 100) {
    return NextResponse.json(
      { query: q, total: 0, error: "query_too_long" },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();

  /* ── H4-3 계측 ────────────────────────────────────────────────
   * 목적은 «지금 인기검색어를 만드는 게» 아니다. 4주 뒤에 만들 수 있게
   * 지금부터 봇과 사람을 갈라 모으는 것이다. 하루 늦으면 하루치가 영구히 없다.
   *
   * ⚠️ 사람도 반드시 'human' 문자열을 남긴다. NULL 은 «미계측(구 데이터 42,576행)» 이라는
   *    뜻이고, 둘이 섞이면 4주 뒤 집계가 둘을 못 가른다 (bot-classify.ts S10-1 규약).
   *
   * ⚠️ 로그인 사용자를 «검색 RPC 와 같이» 조회한다. 순차로 붙이면 검색이 그만큼 느려진다.
   *    지금까지 `p_user_id: null` 을 하드코딩해 «로그인 사용자도 전부 NULL» 로 쌓였고,
   *    그게 「30일 로그인 0건 = 크롤러」 판정의 근거 중 하나였다. 근거 자체가 오염돼 있었다. */
  const uaHeader = req.headers.get("user-agent");
  const botType = classifyBot(uaHeader);
  const userIdPromise: Promise<string | null> = (async () => {
    try {
      const s = await createSupabaseServer();
      const { data } = await s.auth.getUser();
      return data.user?.id ?? null;
    } catch {
      return null;   // 비로그인·쿠키 없음은 정상 경로다
    }
  })();

  try {
    const { data, error } = await (sb as any).rpc("search_kadeora_unified_v3", {
      p_query: q,
      p_limit_per_type: limit,
    });

    if (error) {
      console.error("[/api/search] rpc error:", error);
      return NextResponse.json(
        { query: q, total: 0, error: "rpc_failed", _detail: error.message },
        { status: 200 },
      );
    }

    const result = data as any;

    // s260 fix: log_search 를 await — 결과로 받은 search_log_id (UUID) 를 응답에
    // 포함시켜 client 가 /api/search/click 으로 clicked_rank 를 보낼 수 있게 한다.
    // 이전엔 fire-and-forget 이라 NextResponse.json(result) 직렬화 시점에 _search_log_id
    // 가 아직 비어 있어 client 가 항상 null 을 받았고 → CTR 측정 0.
    let searchLogId: string | null = null;
    try {
      const userId = await userIdPromise;   // RPC 와 병렬로 이미 돌았다 — 여기서 기다리는 시간은 ~0
      const { data: logId } = await (sb as any).rpc("log_search", {
        p_query: q,
        p_results_count: result?.total ?? 0,
        p_user_id: userId,
      });
      if (typeof logId === "string") searchLogId = logId;
    } catch (e) {
      console.error("[/api/search] log_search failed:", e);
    }

    /* user_agent·bot_type 은 «응답을 기다리지 않고» 채운다.
     * ⚠️ `log_search` RPC 에 두 인자가 없어서 뒤따라 UPDATE 한다. RPC 를 고치면
     *    이 블록은 지워도 된다 — 그때까지는 검색 1회당 쓰기 1회가 는다(검색은 저빈도다).
     * ⚠️ 위 `await` 는 «건드리지 말 것». s260 에서 id 를 받으려고 일부러 await 로 바꾼 자리다.
     *    fire-and-forget 으로 되돌리면 client 가 _search_log_id 를 못 받아 CTR 이 다시 0이 된다. */
    if (searchLogId) {
      void (sb as any)
        .from("search_logs")
        .update({ user_agent: uaHeader, bot_type: botType })
        .eq("id", searchLogId)
        .then(({ error }: { error: unknown }) => {
          // ⚠️ 삼키지 않는다. 조용히 실패하면 4주 뒤에야 «빈 집계» 로 알게 된다.
          if (error) console.error("[/api/search] ua/bot stamp failed:", error);
        });
    }

    return NextResponse.json(
      { ...result, _search_log_id: searchLogId },
      {
        status: 200,
        headers: {
          "cache-control": "private, max-age=10, stale-while-revalidate=30",
        },
      },
    );
  } catch (err: any) {
    console.error("[/api/search] fatal:", err);
    return NextResponse.json(
      { query: q, total: 0, error: "internal" },
      { status: 200 },
    );
  }
}
