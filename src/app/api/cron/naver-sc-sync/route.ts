// app/api/cron/naver-sc-sync/route.ts — s258 신규 → 2026-08-05 교체
// 원래 "네이버 Search Advisor insight/search" 엔드포인트는 존재하지 않는 API였음
// (searchadvisor.naver.com/v2/site/.../insight/search — 실제 공개 API 아님, credentials_missing으로
// 72회+ 연속 실패만 기록됨). 네이버 검색 오픈API(openapi.naver.com, 기존 NAVER_CLIENT_ID/SECRET 재사용)
// 기반 키워드 순위 추적으로 교체 → keyword_rank_daily 테이블 적재.
// 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET (기존 재사용, NAVER_SC_* 아님)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logCronStart, logCronEnd } from "@/lib/cron-log";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const NAVER_OPENAPI_BASE = "https://openapi.naver.com/v1/search";
// blog 소스가 전량 권외였던 건 순위가 없어서가 아니라 찾을 대상이 없어서였다.
// 공식 네이버 블로그는 blog.naver.com/kadeoraapp — naver.com 으로 넓히면 남의 글이 잡힌다.
const OUR_DOMAINS = ["kadeora.app", "blog.naver.com/kadeoraapp"] as const;

// 네이버는 m.blog.naver.com/kadeoraapp 로도 돌려준다 — 위 문자열의 부분일치로 함께 걸린다.
// PostView.naver?blogId=kadeoraapp 형태는 경로가 달라 별도로 본다.
function matchesOurSite(link: unknown): boolean {
  if (typeof link !== "string") return false;
  if (OUR_DOMAINS.some((d) => link.includes(d))) return true;
  return /[?&]blogId=kadeoraapp(?:&|$)/.test(link);
}
const DISPLAY = 100;
const SOURCES = ["webkr", "blog"] as const;
type Source = (typeof SOURCES)[number];

type RankRow = {
  date: string;
  keyword: string;
  source: Source;
  rank: number | null;
  matched_url: string | null;
  matched_title: string | null;
  checked_count: number;
  error_message: string | null;
};

async function fetchRank(
  keyword: string,
  source: Source,
  clientId: string,
  clientSecret: string,
  date: string,
): Promise<RankRow> {
  const url =
    `${NAVER_OPENAPI_BASE}/${source}?` +
    new URLSearchParams({ query: keyword, display: String(DISPLAY), start: "1" }).toString();

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`naver_openapi_http_${res.status}_${source}`);
  }
  const json = (await res.json()) as any;
  const items: any[] = Array.isArray(json?.items) ? json.items : [];
  const idx = items.findIndex((it) => matchesOurSite(it?.link));

  return {
    date,
    keyword,
    source,
    rank: idx >= 0 ? idx + 1 : null,
    matched_url: idx >= 0 ? items[idx].link : null,
    matched_title: idx >= 0 ? String(items[idx].title || "").replace(/<[^>]+>/g, "") : null,
    checked_count: items.length,
    error_message: null,
  };
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
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("naver_client_credentials_missing");
    }

    const { data: targets, error: targetsErr } = await supabase
      .from("keyword_rank_targets")
      .select("keyword")
      .eq("active", true);
    if (targetsErr) throw new Error(`targets_query_failed: ${targetsErr.message}`);

    const keywords = (targets ?? []).map((t: any) => t.keyword as string);
    const today = new Date().toISOString().slice(0, 10);

    if (keywords.length === 0) {
      await logCronEnd(supabase, cronId, {
        status: "success",
        records_processed: 0,
        metadata: { reason: "no_active_keywords" },
      });
      return NextResponse.json({ ok: true, date: today, processed: 0, reason: "no_active_keywords" });
    }

    const rows: RankRow[] = [];
    let failed = 0;

    for (const keyword of keywords) {
      for (const source of SOURCES) {
        try {
          rows.push(await fetchRank(keyword, source, clientId, clientSecret, today));
        } catch (e: any) {
          failed++;
          rows.push({
            date: today,
            keyword,
            source,
            rank: null,
            matched_url: null,
            matched_title: null,
            checked_count: 0,
            error_message: (e?.message ?? "unknown").slice(0, 200),
          });
        }
      }
    }

    const { error: upsertErr } = await supabase
      .from("keyword_rank_daily")
      .upsert(rows, { onConflict: "date,keyword,source" });
    if (upsertErr) throw new Error(`upsert_failed: ${upsertErr.message}`);

    await logCronEnd(supabase, cronId, {
      status: failed > 0 ? "partial" : "success",
      records_processed: rows.length,
      records_created: rows.length - failed,
      records_failed: failed,
      metadata: { date: today, keywords: keywords.length, sample: rows.slice(0, 3) },
    });
    return NextResponse.json({ ok: true, date: today, processed: rows.length, failed });
  } catch (e: any) {
    await logCronEnd(supabase, cronId, {
      status: "error",
      error_message: e?.message?.slice(0, 500) ?? "unknown",
    });
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
