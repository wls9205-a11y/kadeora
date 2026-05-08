"use client";
// src/components/apt/AptListSorter.tsx — s259
// 카테고리별 정렬/필터 pill 토글
// URL search param ?sort= 와 동기화 (server component 페이지 호환)

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { AptSortKey, AptCardCategory } from "@/lib/apt/card-types";

const SORT_OPTIONS_BY_CATEGORY: Record<
  AptCardCategory,
  { key: AptSortKey; label: string }[]
> = {
  subscription: [
    { key: "newest",   label: "신규 등록" },
    { key: "ongoing",  label: "진행 중" },
    { key: "deadline", label: "마감 임박" },
    { key: "price_asc", label: "낮은 평당가" },
  ],
  imminent: [
    { key: "deadline", label: "마감 임박순" },
    { key: "newest",   label: "신규 등록" },
  ],
  redev: [
    { key: "newest",   label: "최근 등록" },
    { key: "deadline", label: "단계 변경 임박" },
    { key: "name",     label: "가나다순" },
  ],
  unsold: [
    { key: "newest",     label: "최근 등재" },
    { key: "price_asc",  label: "낮은 평당가" },
    { key: "price_desc", label: "높은 평당가" },
  ],
  complex: [
    { key: "name",       label: "가나다순" },
    { key: "newest",     label: "최근 등록" },
    { key: "price_desc", label: "높은 평당가" },
  ],
};

export default function AptListSorter({
  category,
  defaultSort = "newest",
}: {
  category: AptCardCategory;
  defaultSort?: AptSortKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSort =
    (searchParams.get("sort") as AptSortKey | null) ?? defaultSort;
  const options = SORT_OPTIONS_BY_CATEGORY[category];

  function setSort(key: AptSortKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === defaultSort) params.delete("sort");
    else params.set("sort", key);
    const qs = params.toString();
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  }

  return (
    <div
      role="tablist"
      aria-label="정렬"
      className="flex flex-wrap items-center gap-1.5"
    >
      {options.map((o) => {
        const active = currentSort === o.key;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => setSort(o.key)}
            disabled={isPending}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              active
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
              isPending ? "opacity-50" : "",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// s259 fix: server-side helpers (buildOrderClause, applySort) 분리 → @/lib/apt/card-sort
//   client component 'use client' 와 server-only helper 가 한 파일에 공존하면
//   server component 가 client bundle 을 끌고 들어가는 문제 회피.
