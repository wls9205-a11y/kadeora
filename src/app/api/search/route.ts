// src/app/api/search/route.ts — s260
// 단일 검색 API: GET /api/search?q=강남&limit=5
// → search_kadeora_unified_v3 RPC (181ms 안에 9 도메인 처리)
// → log_search RPC 로 검색어 기록 (백그라운드)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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
      const { data: logId } = await (sb as any).rpc("log_search", {
        p_query: q,
        p_results_count: result?.total ?? 0,
        p_user_id: null,
      });
      if (typeof logId === "string") searchLogId = logId;
    } catch (e) {
      console.error("[/api/search] log_search failed:", e);
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
