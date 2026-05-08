// src/app/api/search/click/route.ts — s260
// POST { search_log_id, rank } → search_logs.clicked_rank 채우기 (CTR 측정)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 5;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body?.search_log_id ?? '').trim();
    const rank = Number(body?.rank);

    // s260 fix: search_logs.id 는 UUID. Number() 캐스트 → log_search_click NaN 으로 항상 실패하던 버그.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id) || !Number.isFinite(rank) || rank < 1) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc("log_search_click", {
      p_search_log_id: id,
      p_clicked_rank: rank,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }
    return NextResponse.json({ ok: true, updated: data === true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "internal" }, { status: 200 });
  }
}
