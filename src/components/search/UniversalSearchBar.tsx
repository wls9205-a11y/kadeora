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
  /**
   * trigger 모양. 'bar' 는 헤더 가운데 들어가는 알약 입력창,
   * 'icon' 은 헤더 우측 액션 줄에 들어가는 36×36 원형 버튼(모바일).
   * 'hero' 는 홈 상단 검색 히어로 (H1-1) — 52px 높이의 넓은 입력창.
   * 모달·타이프어헤드 동작은 셋이 완전히 같다 — 모바일만 /search 로
   * 페이지 이동하던 v3 이전 동작을 여기로 흡수한다.
   *
   * ⚠️ trigger 모양만 다르다. 모달·debounce·정렬에는 손대지 말 것.
   */
  variant?: "bar" | "icon" | "hero";
  /**
   * ⌘K 단축키 리스너를 이 인스턴스가 소유할지.
   * 헤더에 bar·icon 두 인스턴스가 동시에 마운트되므로 한쪽만 true 여야 한다.
   * 둘 다 true 면 keydown 이 두 번 잡혀 숨은 인스턴스의 모달까지 같이 열린다.
   */
  hotkey?: boolean;
};

export default function UniversalSearchBar({
  placeholder = "단지·종목·지역·블로그 검색",
  className = "",
  variant = "bar",
  hotkey = true,
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
    if (!hotkey) return;
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
  }, [open, hotkey]);

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

  // 트렌딩 로드 (모달 열림 1회) — string[] 으로 정규화 (React #31 fix).
  // /api/search/trending 응답이 [{ keyword, heat_score }] 형태일 때 객체가 그대로
  // children 으로 박혀 "Objects are not valid as a React child" 폭발하던 버그.
  useEffect(() => {
    if (!open || trending.length > 0) return;
    fetch("/api/search/trending")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const arr: unknown[] = Array.isArray(data?.keywords)
          ? data.keywords
          : Array.isArray(data)
          ? data
          : [];
        const keywords = arr
          .slice(0, 8)
          .map((k) =>
            typeof k === "string"
              ? k
              : k && typeof k === "object" && "keyword" in k && typeof (k as { keyword?: unknown }).keyword === "string"
              ? ((k as { keyword: string }).keyword)
              : "",
          )
          .filter((s): s is string => s.length > 0);
        setTrending(keywords);
      })
      .catch(() => {});
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
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="검색 열기"
          className={className}
          style={{
            width: 36, height: 36, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "50%",
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <SearchIcon />
        </button>
      ) : variant === "hero" ? (
        /* H1-1 홈 검색 히어로.
         * ⚠️ placeholder 를 16px 미만으로 내리지 말 것 — iOS 사파리가 입력창을
         *    자동 확대해 화면이 튄다. 홈 첫 화면이라 그 튐이 가장 잘 보인다. */
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="검색 열기"
          className={className}
          style={{
            width: "100%",
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 16px",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--border-strong)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <SearchIcon size={19} />
          <span
            style={{
              flex: 1,
              fontSize: 17,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {placeholder}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="검색 열기"
          className={[
            "flex w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50",
            className,
          ].join(" ")}
        >
          <SearchIcon />
          <span className="line-clamp-1 flex-1 text-left">{placeholder}</span>
          <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500 sm:inline">
            ⌘K
          </kbd>
        </button>
      )}

      {/* 모달 */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 검색 입력 */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                aria-label="검색어 입력"
                className="flex-1 bg-transparent text-base outline-none placeholder:text-gray-400"
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
                  className="text-gray-400 hover:text-gray-600"
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
                            className="rounded-full bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200"
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
                            className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
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
                        ? "bg-blue-50"
                        : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {item.cover_image_url ? (
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                        <Image
                          src={item.cover_image_url}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </span>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-lg">
                        {meta.emoji}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-gray-900">
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
                          : "bg-gray-200 text-gray-700",
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
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-xs text-gray-700 hover:bg-gray-50"
        >
          "{resp.query}" 전체 결과 ({resp.total}+) 보기 →
        </button>
      )}
    </div>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
