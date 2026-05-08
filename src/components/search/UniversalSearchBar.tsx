"use client";
// src/components/search/UniversalSearchBar.tsx — s260
// 헤더에 들어가는 단일 검색창. 클릭 또는 ⌘K 로 모달 패널.
// typeahead (debounce 200ms) → /api/search?q=&limit=3 → 카테고리별 결과 표시
// Enter → /search?q=... 결과 페이지

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CATEGORY_KO,
  flattenResults,
  type SearchResultItem,
  type UnifiedSearchResponse,
} from "@/lib/search/parse-query";

type Props = {
  placeholder?: string;
  className?: string;
};

export default function UniversalSearchBar({
  placeholder = "단지·종목·지역·블로그 검색",
  className = "",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<UnifiedSearchResponse | null>(null);
  const [trending, setTrending] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ⌘K / Ctrl+K 단축키
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmd = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmd) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 모달 열림 시 입력 포커스 + recent 로드
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      try {
        const r = JSON.parse(localStorage.getItem("kadeora_recent_search") || "[]");
        if (Array.isArray(r)) setRecent(r.slice(0, 5));
      } catch {}
    }
  }, [open]);

  // 트렌딩 로드 (모달 열림 1회)
  useEffect(() => {
    if (open && trending.length === 0) {
      fetch("/api/search/trending")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (Array.isArray(j?.keywords)) setTrending(j.keywords.slice(0, 8));
          else if (Array.isArray(j)) setTrending(j.slice(0, 8).map((x) => x.keyword ?? x));
        })
        .catch(() => {});
    }
  }, [open, trending.length]);

  // 검색 (debounce 200ms)
  const runSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResp(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      // 이전 in-flight 취소
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const r = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&limit=3`,
          { signal: ac.signal },
        );
        if (!r.ok) throw new Error(String(r.status));
        const j: UnifiedSearchResponse = await r.json();
        setResp(j);
        setActiveIdx(0);
      } catch (e: any) {
        if (e.name !== "AbortError") setResp(null);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQ(val);
    runSearch(val);
  }

  function saveRecent(query: string) {
    if (!query.trim()) return;
    try {
      const prev = JSON.parse(localStorage.getItem("kadeora_recent_search") || "[]");
      const next = [query, ...(Array.isArray(prev) ? prev : [])]
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 10);
      localStorage.setItem("kadeora_recent_search", JSON.stringify(next));
    } catch {}
  }

  function goToResultsPage(query: string) {
    if (!query.trim()) return;
    saveRecent(query);
    setOpen(false);
    setQ("");
    setResp(null);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function goToItem(item: SearchResultItem, rank: number) {
    saveRecent(q);
    // log_search_click via API (fire-and-forget)
    if ((resp as any)?._search_log_id) {
      fetch("/api/search/click", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          search_log_id: (resp as any)._search_log_id,
          rank,
        }),
      }).catch(() => {});
    }
    setOpen(false);
    setQ("");
    setResp(null);
    router.push(item.url);
  }

  // 키보드 네비게이션
  const flatResults = resp ? flattenResults(resp, 3) : [];
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults.length > 0 && activeIdx < flatResults.length) {
        goToItem(flatResults[activeIdx], activeIdx + 1);
      } else {
        goToResultsPage(q);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      {/* 헤더에 들어가는 trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="검색 열기"
        className={[
          "flex w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800",
          className,
        ].join(" ")}
      >
        <SearchIcon />
        <span className="line-clamp-1 flex-1 text-left">{placeholder}</span>
        <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500 sm:inline dark:border-gray-700 dark:bg-gray-800">
          ⌘K
        </kbd>
      </button>

      {/* 모달 */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 검색 입력 */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                aria-label="검색어 입력"
                className="flex-1 bg-transparent text-base outline-none placeholder:text-gray-400 dark:text-gray-50"
              />
              {loading && <SpinnerIcon />}
              {q && (
                <button
                  onClick={() => {
                    setQ("");
                    setResp(null);
                    inputRef.current?.focus();
                  }}
                  aria-label="입력 지우기"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 결과 패널 */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {/* 결과 표시 */}
              {q && resp && (
                <ResultsPanel
                  resp={resp}
                  activeIdx={activeIdx}
                  onItemClick={(item, rank) => goToItem(item, rank)}
                  onSeeAll={() => goToResultsPage(q)}
                />
              )}

              {/* 빈 검색 — 최근/트렌딩 */}
              {!q && (
                <div className="space-y-4 p-2">
                  {recent.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-bold text-gray-500">최근 검색</h3>
                      <div className="flex flex-wrap gap-2">
                        {recent.map((kw) => (
                          <button
                            key={`r-${kw}`}
                            onClick={() => goToResultsPage(kw)}
                            className="rounded-full bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {trending.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-bold text-gray-500">🔥 인기 검색어</h3>
                      <div className="flex flex-wrap gap-2">
                        {trending.map((kw) => (
                          <button
                            key={`t-${kw}`}
                            onClick={() => goToResultsPage(kw)}
                            className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="px-1 pt-2 text-[11px] text-gray-400">
                    ↑↓ 선택 · Enter 이동 · ESC 닫기
                  </div>
                </div>
              )}

              {/* 결과 없음 */}
              {q && resp && resp.total === 0 && !loading && (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-500">"{q}" 검색 결과가 없습니다.</p>
                  <p className="mt-2 text-xs text-gray-400">단지명·지역·종목명·키워드로 다시 시도해보세요.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- 결과 패널 ---
function ResultsPanel({
  resp,
  activeIdx,
  onItemClick,
  onSeeAll,
}: {
  resp: UnifiedSearchResponse;
  activeIdx: number;
  onItemClick: (item: SearchResultItem, rank: number) => void;
  onSeeAll: () => void;
}) {
  const order = resp.priority_order ?? [
    "apt_sites", "complexes", "subscriptions",
    "redev", "unsold", "regions",
    "blogs", "posts", "stocks",
  ];

  let runningIdx = 0;
  const sections = order
    .map((key) => {
      const arr = (resp as any)[key] as SearchResultItem[] | undefined;
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const meta = CATEGORY_KO[key] ?? { label: key, emoji: "•" };
      const items = arr.slice(0, 3);
      return { key, items, meta };
    })
    .filter(Boolean) as { key: string; items: SearchResultItem[]; meta: { label: string; emoji: string } }[];

  return (
    <div>
      {sections.map(({ key, items, meta }) => (
        <div key={key} className="mb-3">
          <h3 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <span className="mr-1">{meta.emoji}</span>
            {meta.label} <span className="font-normal opacity-50">({items.length})</span>
          </h3>
          <ul>
            {items.map((item, i) => {
              const myIdx = runningIdx++;
              const isActive = myIdx === activeIdx;
              return (
                <li key={`${key}-${item.id}`}>
                  <button
                    onClick={() => onItemClick(item, myIdx + 1)}
                    onMouseEnter={() => {/* hover index 동기화 안 함 (키보드 우선) */}}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800",
                    ].join(" ")}
                  >
                    {item.cover_image_url ? (
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                        <Image
                          src={item.cover_image_url}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </span>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-lg dark:bg-gray-800">
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
                        "ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        item.dday <= 3 ? "bg-red-500 text-white"
                          : item.dday <= 7 ? "bg-amber-500 text-white"
                          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
                      ].join(" ")}>
                        D-{item.dday}
                      </span>
                    )}
                    {item.count !== undefined && item.count > 0 && (
                      <span className="ml-2 text-[10px] text-gray-400 tabular-nums">
                        {item.count}건
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {resp.total > sections.reduce((sum, s) => sum + s.items.length, 0) && (
        <button
          onClick={onSeeAll}
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          "{resp.query}" 전체 결과 ({resp.total}+) 보기 →
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
