// app/api/cron/naver-sc-sync/route.ts — s258 신규 → 2026-08-05 교체
// 원래 "네이버 Search Advisor insight/search" 엔드포인트는 존재하지 않는 API였음
// (searchadvisor.naver.com/v2/site/.../insight/search — 실제 공개 API 아님, credentials_missing으로
// 72회+ 연속 실패만 기록됨). 네이버 검색 오픈API(openapi.naver.com, 기존 NAVER_CLIENT_ID/SECRET 재사용)
// 기반 키워드 순위 추적으로 교체 → keyword_rank_daily 테이블 적재.
// 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET (기존 재사용, NAVER_SC_* 아님)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logCronStart, logCronEnd } from "@/lib/cron-log";

// [§4] keyword_rank_targets 가 71 → 641 개로 늘었다. 641 × 2 소스 = 1,282 회를
//   순차로 돌면 30 초에 절대 못 들어간다. 회전 배치(200) + 5 병렬로 바꾸고 120 초를 준다.
//
//   ⚠️ 이 export 만으로는 부족하다. vercel.json 의 캐치올
//   ⚠️ 2026-08-27 정정 — 캐치올(30)은 라우트 export 를 덮지 «않는다»(Rule #18).
//   당시 넣은 vercel.json 개별 오버라이드는 없어도 됐던 것으로 보인다.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** 한 번에 도는 키워드 수. 641 / 200 ≈ 3~4 일 주기로 전량 한 바퀴. */
const BATCH_LIMIT = 200;

/** 네이버 오픈API 레이트리밋 때문에 5 를 넘기지 않는다. 200 × 2 = 400 회를 약 16 초. */
const CONCURRENCY = 5;

/** 배열을 size 개씩 끊어 순차 실행. 각 청크 안은 병렬. */
async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

const NAVER_OPENAPI_BASE = "https://openapi.naver.com/v1/search";
// blog 소스는 네이버 블로그 검색이라 kadeora.app 로는 구조적으로 절대 매칭되지 않는다.
// 지금까지 blog 순위가 전량 권외로 나온 것은 순위가 없어서가 아니라 찾을 대상이 없어서였다.
// 계정명까지 포함해 좁게 매칭한다 — naver.com 만으로 완화하면 남의 글이 잡힌다.
const OUR_DOMAINS = ["kadeora.app", "blog.naver.com/kadeoraapp"] as const;

// r4: m.blog.naver.com/kadeoraapp 은 위 문자열의 부분일치로 함께 걸린다.
// PostView.naver?blogId=kadeoraapp 형태만 경로가 달라 별도로 본다.
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
  // 회전 배치가 120 초 안에 들어오는지 §9 체크리스트에서 확인해야 한다.
  const startedAt = Date.now();

  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("naver_client_credentials_missing");
    }

    // [§4-2] 대상 조회를 RPC 로. `active` 가 아니라 `tracked` 를 보고,
    //   priority 오름차순 → last_checked_at 오래된 순으로 회전시킨다.
    //   priority=1(현재 순위가 잡히는 13 개)은 항상 배치에 포함돼 매일 측정된다.
    //   실측 — get_rank_targets_due(200) 은 200 건 반환, 그중 priority=1 이 13 건 전부.
    //   RPC 는 DB 담당 배포분(security invoker, service_role 만 EXECUTE). 수정하지 않는다.
    const { data: targets, error: targetsErr } = await supabase
      .rpc("get_rank_targets_due", { p_limit: BATCH_LIMIT });
    if (targetsErr) throw new Error(`targets_rpc_failed: ${targetsErr.message}`);

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

    // [§4-3] 순차 → 청크 병렬. (keyword × source) 를 평탄화해 5 개씩 묶어 돈다.
    const jobs: { keyword: string; source: Source }[] = keywords.flatMap((keyword: string) =>
      SOURCES.map((source) => ({ keyword, source })));
    let failed = 0;

    const rows: RankRow[] = await inChunks(jobs, CONCURRENCY, async ({ keyword, source }) => {
      try {
        return await fetchRank(keyword, source, clientId, clientSecret, today);
      } catch (e: any) {
        failed++;
        return {
          date: today,
          keyword,
          source,
          rank: null,
          matched_url: null,
          matched_title: null,
          checked_count: 0,
          error_message: (e?.message ?? "unknown").slice(0, 200),
        };
      }
    });

    // keyword_rank_daily 에 UNIQUE (date, keyword, source) 가 실재한다(실측 확인).
    // onConflict 가 그 제약과 정확히 일치하므로 중복 적재는 막힌다.
    const { error: upsertErr } = await supabase
      .from("keyword_rank_daily")
      .upsert(rows, { onConflict: "date,keyword,source" });
    if (upsertErr) throw new Error(`upsert_failed: ${upsertErr.message}`);

    // [§4-4] 성공·실패 무관하게 이번 배치를 스탬프한다.
    //   안 찍으면 last_checked_at 이 그대로라 «같은 200 개» 가 영원히 반복된다.
    //   upsert 뒤에 둔 것은 의도적이다 — 적재가 실패하면 다음 회차에 다시 잡혀야 한다.
    const { error: markErr } = await supabase
      .rpc("mark_rank_targets_checked", { p_keywords: keywords });
    if (markErr) throw new Error(`mark_checked_failed: ${markErr.message}`);

    await logCronEnd(supabase, cronId, {
      status: failed > 0 ? "partial" : "success",
      records_processed: rows.length,
      records_created: rows.length - failed,
      records_failed: failed,
      metadata: {
        date: today,
        keywords: keywords.length,
        batch_limit: BATCH_LIMIT,
        concurrency: CONCURRENCY,
        elapsed_ms: Date.now() - startedAt,
        sample: rows.slice(0, 3),
      },
    });
    return NextResponse.json({
      ok: true, date: today, processed: rows.length, failed,
      keywords: keywords.length, elapsed_ms: Date.now() - startedAt,
    });
  } catch (e: any) {
    await logCronEnd(supabase, cronId, {
      status: "error",
      error_message: e?.message?.slice(0, 500) ?? "unknown",
    });
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
