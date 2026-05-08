// app/api/cron/naver-sc-sync/route.ts — s258 신규
// 네이버 Search Advisor (https://searchadvisor.naver.com/) Open API 동기화
// 키워드/페이지/디바이스 차원 일별 데이터 → naver_sc_daily 적재
// 환경변수: NAVER_SC_CLIENT_ID, NAVER_SC_CLIENT_SECRET, NAVER_SC_PROPERTY_ID
// Architecture Rule #16: maxDuration=10

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logCronStart, logCronEnd } from "@/lib/cron-log";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

const NAVER_API_BASE = "https://searchadvisor.naver.com/v2/site";

type NaverScRow = {
  date: string;
  page_url: string;
  impression: number;
  click: number;
  ctr: number;
  avg_rank: number;
};

async function fetchNaverScDaily(date: string): Promise<NaverScRow[]> {
  const clientId = process.env.NAVER_SC_CLIENT_ID;
  const clientSecret = process.env.NAVER_SC_CLIENT_SECRET;
  const propertyId = process.env.NAVER_SC_PROPERTY_ID; // 등록 사이트 ID
  if (!clientId || !clientSecret || !propertyId) {
    throw new Error("naver_sc_credentials_missing");
  }
  const url =
    `${NAVER_API_BASE}/${encodeURIComponent(propertyId)}/insight/search?` +
    new URLSearchParams({
      startDate: date,
      endDate: date,
      dimension: "page",
      limit: "1000",
    }).toString();

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`naver_sc_http_${res.status}`);
  }
  const json = (await res.json()) as any;
  const rows: NaverScRow[] = (json?.results ?? []).map((r: any) => ({
    date,
    page_url: r.page ?? r.url ?? "",
    impression: Number(r.impression ?? r.impressions ?? 0),
    click: Number(r.click ?? r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
    avg_rank: Number(r.avgRank ?? r.position ?? 0),
  }));
  return rows;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const cronId = await logCronStart(supabase, "naver-sc-sync");

  try {
    // 어제 데이터 1일치만 (네이버 SC는 보통 D-1 기준 제공)
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    const dateStr = d.toISOString().slice(0, 10);

    const rows = await fetchNaverScDaily(dateStr);
    let upserted = 0;
    let failed = 0;

    if (rows.length > 0) {
      const { error } = await supabase
        .from("naver_sc_daily")
        .upsert(rows, { onConflict: "date,page_url" });
      if (error) {
        failed = rows.length;
        throw new Error(`upsert_failed: ${error.message}`);
      }
      upserted = rows.length;
    }

    await logCronEnd(supabase, cronId, {
      status: "success",
      records_processed: rows.length,
      records_created: upserted,
      records_failed: failed,
      metadata: { date: dateStr, sample: rows.slice(0, 3) },
    });
    return NextResponse.json({
      ok: true,
      date: dateStr,
      rows: rows.length,
      upserted,
    });
  } catch (e: any) {
    await logCronEnd(supabase, cronId, {
      status: "error",
      error_message: e?.message?.slice(0, 500) ?? "unknown",
    });
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown" },
      { status: 500 },
    );
  }
}
