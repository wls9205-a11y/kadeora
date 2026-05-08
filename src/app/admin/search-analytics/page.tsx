// src/app/admin/search-analytics/page.tsx — s260
// 검색 분석 어드민 — health, top keywords, zero-result 키워드 발굴 (SEO)

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 60;
export const maxDuration = 10;

export const metadata = {
  title: "검색 분석 — Admin",
  robots: { index: false, follow: false },
};

type Health = {
  searches_24h: number;
  searches_7d: number;
  zero_result_7d: number;
  clicked_7d: number;
  ctr_7d_pct: number | null;
  zero_rate_7d_pct: number | null;
  unique_zero_keywords_7d: number;
};

type TopKw = {
  keyword: string;
  d1_count: number;
  d7_count: number;
  d30_count: number;
  avg_results: number | null;
  ctr_pct: number | null;
  last_searched_at: string;
  heat_level: string;
};

type ZeroKw = {
  keyword: string;
  search_count: number;
  last_searched_at: string;
  unique_users: number;
};

export default async function AdminSearchAnalytics() {
  const sb = getSupabaseAdmin();

  const [healthRes, topRes, zeroRes] = await Promise.allSettled([
    (sb as any).from("v_search_health").select("*").single(),
    (sb as any).from("v_search_top_keywords").select("*").limit(30),
    (sb as any).from("v_search_zero_result").select("*").limit(30),
  ]);

  const health = healthRes.status === "fulfilled" ? (healthRes.value.data as Health | null) : null;
  const topKeywords = topRes.status === "fulfilled" ? ((topRes.value.data as TopKw[]) ?? []) : [];
  const zeroKeywords = zeroRes.status === "fulfilled" ? ((zeroRes.value.data as ZeroKw[]) ?? []) : [];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-2 text-2xl font-bold">검색 분석</h1>
      <p className="mb-6 text-sm text-gray-500">최근 7일 ~ 30일 검색 행동 / zero-result 키워드 발굴</p>

      {/* Health 요약 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-300">📊 헬스 요약</h2>
        {health ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="검색 24h" value={health.searches_24h} />
            <Stat label="검색 7d" value={health.searches_7d} />
            <Stat
              label="CTR 7d"
              value={health.ctr_7d_pct ?? 0}
              suffix="%"
              tone={(health.ctr_7d_pct ?? 0) < 5 ? "danger" : "ok"}
            />
            <Stat
              label="결과 0 비율 7d"
              value={health.zero_rate_7d_pct ?? 0}
              suffix="%"
              tone={(health.zero_rate_7d_pct ?? 0) > 30 ? "danger" : "ok"}
            />
            <Stat label="결과 0 키워드 종류 7d" value={health.unique_zero_keywords_7d} />
            <Stat label="클릭 7d" value={health.clicked_7d} />
            <Stat label="결과 0 검색 수 7d" value={health.zero_result_7d} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">헬스 데이터 없음</p>
        )}
      </section>

      {/* 인기 검색어 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-300">
          🔥 인기 검색어 (최근 30일)
        </h2>
        {topKeywords.length === 0 ? (
          <p className="text-sm text-gray-500">데이터 없음</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="p-2 text-left">키워드</th>
                  <th className="p-2 text-right">24h</th>
                  <th className="p-2 text-right">7d</th>
                  <th className="p-2 text-right">30d</th>
                  <th className="p-2 text-right">평균 결과</th>
                  <th className="p-2 text-right">CTR</th>
                  <th className="p-2 text-center">level</th>
                </tr>
              </thead>
              <tbody>
                {topKeywords.map((k) => (
                  <tr key={k.keyword} className="border-t border-gray-200 dark:border-gray-800">
                    <td className="p-2 font-medium">{k.keyword}</td>
                    <td className="p-2 text-right tabular-nums">{k.d1_count}</td>
                    <td className="p-2 text-right tabular-nums">{k.d7_count}</td>
                    <td className="p-2 text-right tabular-nums">{k.d30_count}</td>
                    <td className="p-2 text-right tabular-nums text-gray-500">
                      {k.avg_results !== null ? k.avg_results.toFixed(1) : "-"}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {k.ctr_pct !== null ? `${k.ctr_pct.toFixed(1)}%` : "-"}
                    </td>
                    <td className="p-2 text-center">
                      <HeatBadge level={k.heat_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Zero-result (SEO 발굴) */}
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">
          ❓ 결과 0 키워드 (SEO 발굴)
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          사용자가 검색했으나 결과 없음 → 콘텐츠/RPC 누락 의심. 블로그 발행 또는 RPC 보강 검토.
        </p>
        {zeroKeywords.length === 0 ? (
          <p className="text-sm text-gray-500">결과 0 키워드 없음 (또는 results_count NULL — 30일 누적 데이터 필요)</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-amber-200 dark:border-amber-900">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 dark:bg-amber-950/30">
                <tr>
                  <th className="p-2 text-left">키워드</th>
                  <th className="p-2 text-right">검색 횟수</th>
                  <th className="p-2 text-right">고유 사용자</th>
                  <th className="p-2 text-right">최근 검색</th>
                </tr>
              </thead>
              <tbody>
                {zeroKeywords.map((k) => (
                  <tr key={k.keyword} className="border-t border-amber-200 dark:border-amber-900">
                    <td className="p-2 font-medium">{k.keyword}</td>
                    <td className="p-2 text-right tabular-nums">{k.search_count}</td>
                    <td className="p-2 text-right tabular-nums">{k.unique_users}</td>
                    <td className="p-2 text-right text-xs text-gray-500">
                      {new Date(k.last_searched_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, suffix = "", tone = "ok" }: {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p
        className={[
          "mt-1 text-xl font-bold tabular-nums",
          tone === "danger" ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-50",
        ].join(" ")}
      >
        {value}
        <span className="ml-0.5 text-xs font-normal text-gray-400">{suffix}</span>
      </p>
    </div>
  );
}

function HeatBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    hot:      "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    trending: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    steady:   "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    normal:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[level] ?? styles.normal}`}>
      {level}
    </span>
  );
}
