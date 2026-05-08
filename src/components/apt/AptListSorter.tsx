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

// 서버 컴포넌트 측에서 ORDER BY 절을 만들 때 쓰는 헬퍼
export function buildOrderClause(sort: AptSortKey | null | undefined): string {
  switch (sort) {
    case "deadline":
      return "date_end ASC NULLS LAST, dday_end ASC NULLS LAST";
    case "ongoing":
      // status='ongoing' 우선 + date_end ASC
      return "(status = 'ongoing') DESC, date_end ASC NULLS LAST";
    case "name":
      return "name ASC";
    case "price_asc":
      return "price_per_pyeong ASC NULLS LAST";
    case "price_desc":
      return "price_per_pyeong DESC NULLS LAST";
    case "newest":
    default:
      return "created_at DESC, id DESC";
  }
}

// supabase-js 의 .order() 체이닝용 헬퍼
export function applySort<
  T extends {
    order: (
      column: string,
      opts?: { ascending?: boolean; nullsFirst?: boolean },
    ) => T;
  },
>(query: T, sort: AptSortKey | null | undefined): T {
  switch (sort) {
    case "deadline":
      return query
        .order("date_end", { ascending: true, nullsFirst: false })
        .order("dday_end", { ascending: true, nullsFirst: false });
    case "ongoing":
      // (status='ongoing') DESC 는 supabase-js 로 표현 어려움 → 페이지 측에서 별도 필터
      return query.order("date_end", { ascending: true, nullsFirst: false });
    case "name":
      return query.order("name", { ascending: true });
    case "price_asc":
      return query.order("price_per_pyeong", { ascending: true, nullsFirst: false });
    case "price_desc":
      return query.order("price_per_pyeong", { ascending: false, nullsFirst: false });
    case "newest":
    default:
      return query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
  }
}
