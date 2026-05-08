// src/app/(main)/apt/search/page.tsx — s260
// 기존 /apt/search 의 timeout 문제 fix:
// before: page 가 .from('apt_complex_profiles').ilike('region_nm', ...) 직접 호출 (timeout)
// after:  search_kadeora_unified_v3 RPC 호출 (181ms)
// 또한 /search 로 redirect 권장 메시지 표시

import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  CATEGORY_KO,
  type SearchResultItem,
  type UnifiedSearchResponse,
} from "@/lib/search/parse-query";

export const dynamic = "force-dynamic";
export const revalidate = 30;
export const maxDuration = 10;

type Props = {
  searchParams: Promise<{ q?: string; redirect?: string }>;
};

export async function generateMetadata({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  return {
    title: q ? `"${q}" 부동산 검색` : "부동산 검색",
    robots: { index: false, follow: true },
  };
}

export default async function AptSearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  // /apt/search → /search 로 자동 redirect (질의 있을 때만)
  // (옵션) 기존 사용자 리다이렉트 — 점진적 마이그레이션을 원하면 아래 주석 처리
  if (q && sp.redirect !== "no") {
    redirect(`/search?q=${encodeURIComponent(q)}`);
  }

  if (!q) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-2 text-xl font-bold">부동산 검색</h1>
        <p className="text-sm text-gray-500">
          상단 검색창에서 단지명, 지역, 청약공고를 검색하세요.
        </p>
      </div>
    );
  }

  // redirect=no 일 때만 부동산 카테고리만 보여주는 fallback 모드
  const sb = getSupabaseAdmin();
  let resp: UnifiedSearchResponse | null = null;
  try {
    const { data, error } = await (sb as any).rpc("search_kadeora_unified_v3", {
      p_query: q,
      p_limit_per_type: 12,
    });
    if (!error) resp = data as UnifiedSearchResponse;
  } catch {}

  const aptOnlyKeys = ["apt_sites", "complexes", "subscriptions", "redev", "unsold", "regions"];
  const sections = aptOnlyKeys
    .map((key) => {
      const arr = (resp as any)?.[key] as SearchResultItem[] | undefined;
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const meta = CATEGORY_KO[key] ?? { label: key, emoji: "•" };
      return { key, items: arr, meta };
    })
    .filter(Boolean) as { key: string; items: SearchResultItem[]; meta: { label: string; emoji: string } }[];

  const total = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">
          "<span className="text-blue-600 dark:text-blue-400">{q}</span>" 부동산 검색
          <span className="ml-2 text-sm font-normal text-gray-500">
            {total > 0 ? `${total}건` : "결과 없음"}
          </span>
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          전체 카테고리 통합 검색은
          <Link href={`/search?q=${encodeURIComponent(q)}`} className="ml-1 text-blue-600 underline dark:text-blue-400">
            /search 페이지
          </Link>
          에서.
        </p>
      </header>

      {total === 0 && (
        <div className="py-12 text-center">
          <p className="text-base text-gray-700 dark:text-gray-300">검색 결과가 없습니다.</p>
        </div>
      )}

      <div className="space-y-6">
        {sections.map(({ key, items, meta }) => (
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
                        <span className="line-clamp-1 text-xs text-gray-500">{item.subtitle}</span>
                      )}
                    </span>
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
