// src/app/(main)/search/page.tsx — s260
// 통합 검색 결과 페이지 — 카테고리 탭 + 모든 도메인 결과
// /search?q=강남 → 9 도메인 결과를 카테고리 탭으로 분류

import Link from "next/link";
import Image from "next/image";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  CATEGORY_KO,
  parseSearchQuery,
  type SearchResultItem,
  type UnifiedSearchResponse,
} from "@/lib/search/parse-query";

export const dynamic = "force-dynamic";
export const revalidate = 30;
export const maxDuration = 10;

type Props = {
  searchParams: Promise<{ q?: string; tab?: string; limit?: string }>;
};

export async function generateMetadata({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  return {
    title: q ? `"${q}" 검색 결과` : "검색",
    description: q
      ? `${q} 관련 단지, 청약, 재개발, 미분양, 종목, 블로그 통합 검색 결과`
      : "카더라 통합 검색",
    robots: { index: false, follow: true },  // 검색 결과 페이지 noindex
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const tab = sp.tab ?? "all";
  const limit = Math.min(Math.max(parseInt(sp.limit ?? "10", 10), 5), 30);

  if (!q) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-2 text-xl font-bold">검색</h1>
        <p className="text-sm text-gray-500">상단 검색창에서 단지·종목·지역·블로그 등을 검색하세요.</p>
      </div>
    );
  }

  const parsed = parseSearchQuery(q);
  const sb = getSupabaseAdmin();

  let resp: UnifiedSearchResponse | null = null;
  let rpcError: string | null = null;
  try {
    const { data, error } = await (sb as any).rpc("search_kadeora_unified_v3", {
      p_query: parsed.cleaned || q,
      p_limit_per_type: limit,
    });
    if (error) rpcError = error.message;
    else resp = data as UnifiedSearchResponse;
  } catch (e: any) {
    rpcError = e?.message ?? "rpc_failed";
  }

  // log_search (fire-and-forget)
  void (async () => {
    try {
      await (sb as any).rpc("log_search", {
        p_query: q,
        p_results_count: resp?.total ?? 0,
        p_user_id: null,
      });
    } catch {}
  })();

  const order = resp?.priority_order ?? [
    "apt_sites", "complexes", "subscriptions",
    "redev", "unsold", "regions",
    "blogs", "posts", "stocks",
  ];

  const sectionData = order
    .map((key) => {
      const arr = (resp as any)?.[key] as SearchResultItem[] | undefined;
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const meta = CATEGORY_KO[key] ?? { label: key, emoji: "•" };
      return { key, items: arr, meta };
    })
    .filter(Boolean) as { key: string; items: SearchResultItem[]; meta: { label: string; emoji: string } }[];

  const total = resp?.total ?? 0;
  const visibleSections = tab === "all"
    ? sectionData
    : sectionData.filter((s) => s.key === tab);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">
          "<span className="text-blue-600 dark:text-blue-400">{q}</span>" 검색 결과
          <span className="ml-2 text-sm font-normal text-gray-500">
            {total > 0 ? `${total}건` : "결과 없음"}
          </span>
        </h1>
        {(parsed.month || parsed.year || parsed.category || parsed.region) && (
          <p className="mt-1 text-xs text-gray-500">
            {parsed.year && <span className="mr-2">📅 {parsed.year}년</span>}
            {parsed.month && <span className="mr-2">📅 {parsed.month}월</span>}
            {parsed.region && <span className="mr-2">🗺 {parsed.region}</span>}
            {parsed.category && <span className="mr-2">🏷 {parsed.category}</span>}
          </p>
        )}
      </header>

      {/* 카테고리 탭 */}
      {sectionData.length > 0 && (
        <nav className="mb-4 flex flex-wrap gap-1.5 border-b border-gray-200 pb-1 dark:border-gray-800">
          <TabLink q={q} tab="all" current={tab} label={`전체 (${total})`} />
          {sectionData.map((s) => (
            <TabLink
              key={s.key}
              q={q}
              tab={s.key}
              current={tab}
              label={`${s.meta.emoji} ${s.meta.label} (${s.items.length})`}
            />
          ))}
        </nav>
      )}

      {/* 결과 없음 */}
      {total === 0 && !rpcError && (
        <div className="py-16 text-center">
          <p className="text-base text-gray-700 dark:text-gray-300">검색 결과가 없습니다.</p>
          <p className="mt-2 text-sm text-gray-500">다른 키워드를 시도해보세요.</p>
          <p className="mt-4 text-xs text-gray-400">
            💡 단지명, 지역, 종목명, 블로그 키워드 등으로 검색 가능합니다.
          </p>
        </div>
      )}

      {/* 에러 */}
      {rpcError && (
        <div className="my-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          검색 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {/* 카테고리별 결과 */}
      <div className="space-y-6">
        {visibleSections.map(({ key, items, meta }) => (
          <section key={key}>
            <h2 className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
              <span className="mr-1">{meta.emoji}</span>
              {meta.label}
              <span className="ml-1.5 text-xs font-normal text-gray-400">({items.length})</span>
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <li key={`${key}-${item.id}`}>
                  <Link
                    href={item.url}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5 transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                  >
                    {item.cover_image_url ? (
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                        <Image
                          src={item.cover_image_url}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </span>
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xl dark:bg-gray-800">
                        {meta.emoji}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-gray-900 dark:text-gray-50">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="line-clamp-1 text-xs text-gray-500">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    {item.dday !== undefined && item.dday !== null && (
                      <span className={[
                        "ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        item.dday <= 3 ? "bg-red-500 text-white"
                          : item.dday <= 7 ? "bg-amber-500 text-white"
                          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
                      ].join(" ")}>
                        D-{item.dday}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function TabLink({ q, tab, current, label }: {
  q: string; tab: string; current: string; label: string;
}) {
  const active = tab === current;
  const params = new URLSearchParams({ q, tab });
  return (
    <Link
      href={`/search?${params.toString()}`}
      className={[
        "rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
