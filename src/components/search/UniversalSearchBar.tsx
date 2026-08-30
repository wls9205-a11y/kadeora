"use client";
// src/components/search/UniversalSearchBar.tsx — s260
// 헤더에 들어가는 단일 검색창. 클릭 또는 ⌘K 로 모달 패널.
// typeahead (debounce 200ms) → /api/search?q=&limit=3 → 카테고리별 결과 표시
// Enter → /search?q=... 결과 페이지

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { shortSiteName } from "@/lib/apt/short-name";
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
  /**
   * H3-2 — hero trigger 의 회전 문구. 실제 현장명을 넣는다.
   *
   * 정지한 회색 안내문은 스크롤에 묻힌다. 실제 단지명이 돌아가면
   * "여기서 단지명을 검색한다" 가 설명 없이 전달된다.
   *
   * ⚠️ hero variant 에서만 쓴다. 헤더의 bar·icon 은 그대로 둔다.
   * ⚠️ 안 넘기거나 1개 이하면 회전하지 않고 placeholder 를 그대로 쓴다 —
   *    데이터 조회가 실패해도 검색창은 평소대로 보여야 한다.
   */
  rotatingPlaceholders?: string[];
  /**
   * H3-3 — 모달의 추천 칩을 이 목록으로 «대체»한다. 넘기면 /api/search/trending 을 아예 부르지 않는다.
   *
   * 왜: trending_keywords 상위 12건이 전부 heat_score 100 이라 순위가 없고,
   * `2026` `아파트` 처럼 검색어가 아닌 값과 부울경 밖인 `경기` `서울` 이 섞여 있다.
   * 누른 사람이 무엇을 기대해야 할지 모르는 값이다.
   *
   * ⚠️ 홈에서만 넘긴다. 다른 페이지의 검색 모달은 지금처럼 trending 을 쓴다 —
   *    테이블·크론은 그대로 두고 «홈에서 참조만» 끊는 것이다.
   */
  suggestions?: string[];
  /**
   * H5-1 — hero 를 «네이비 색면 위» 에 올릴 때의 톤.
   *
   * ⚠️ 칩 스타일이 인라인이라 CSS 로는 못 바꾼다(인라인은 모든 @layer 를 이긴다).
   *    그래서 프롭으로 받는다. 컴포넌트를 다시 만들지 않는다 — 검색 동작·모달·
   *    회전 문구는 그대로고 «색만» 갈린다.
   */
  tone?: 'light' | 'dark';
  /** 칩 줄 위 제목을 낼지. H5-1 히어로는 라벨 없이 칩만 낸다. */
  showSuggestionLabel?: boolean;
  /** 추천 칩 제목. suggestions 를 넘길 때 내용에 맞춰 바꾼다. */
  suggestionLabel?: string;
};

/** 회전 한 바퀴 간격. 더 빠르면 읽기 전에 바뀐다. */
const ROTATE_MS = 2200;
/** 페이드 아웃에 쓰는 시간. 이만큼 뒤에 텍스트를 갈아 끼운다. */
const FADE_MS = 220;

export default function UniversalSearchBar({
  placeholder = "단지·종목·지역·블로그 검색",
  className = "",
  variant = "bar",
  hotkey = true,
  rotatingPlaceholders,
  suggestions,
  suggestionLabel = "인기 검색어",
  tone = 'light',
  showSuggestionLabel = true,
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

  /* ── 결함 1호 수리 (2026-08-30) — 오버레이를 body 로 «내보낸다» ─────────────
   * 이 모달은 <header> «안» 에서 렌더된다. 그런데 헤더에는 backdrop-filter: blur(16px)
   * 가 걸려 있고, backdrop-filter 가 none 이 아닌 요소는 자손 position:fixed 의
   * «기준 상자(containing block)» 가 된다 — 즉 inset:0 이 뷰포트가 아니라
   * «높이 45px 짜리 헤더» 를 가리켰다. items-center 가 그 45px 상자의 중앙에
   * 패널을 맞추면서 입력 줄이 화면 위(y=-54)로 밀려났다. 실측 6폭 전부 같은 값이다.
   *
   * ⚠️ E 층의 「overflow-x:hidden 이 sticky 를 죽인다」와 «같은 형태» 다.
   *    장식·방어 목적의 CSS 한 줄이 위치 지정 기능을 조용히 먹는다.
   * → 좌표를 밀어 맞추지 않고 «기준 상자 밖» 으로 옮긴다. portal 이 그 일이다.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /** 닫은 뒤 포커스를 돌려줄 자리. 열기 «직전» 의 활성 요소를 그대로 기억한다. */
  const restoreRef = useRef<HTMLElement | null>(null);
  const openSearch = useCallback(() => {
    if (typeof document !== "undefined") {
      const ae = document.activeElement;
      restoreRef.current = ae instanceof HTMLElement ? ae : null;
    }
    setOpen(true);
  }, []);
  const closeSearch = useCallback(() => setOpen(false), []);

  /* ── H3-2 회전 플레이스홀더 ──────────────────────────────────────────── */
  const rotateList = variant === "hero" ? (rotatingPlaceholders ?? []) : [];
  const canRotate = rotateList.length > 1;
  const [rotIdx, setRotIdx] = useState(0);
  const [rotShown, setRotShown] = useState(true);
  const fadeRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!canRotate) return;
    // ⚠️ 타이핑 중이거나 모달이 열려 있으면 돌리지 않는다. 사용자가 글자를 넣고 있는데
    //    뒤에서 문구가 바뀌면 산만하다. (모달 안 입력창은 기본 placeholder 를 쓴다)
    if (open || q) return;
    // ⚠️ 움직임을 줄이겠다고 한 사용자에게는 첫 값으로 고정한다.
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const id = setInterval(() => {
      setRotShown(false);
      fadeRef.current = setTimeout(() => {
        setRotIdx((i) => (i + 1) % rotateList.length);
        setRotShown(true);
      }, FADE_MS);
    }, ROTATE_MS);

    // ⚠️ interval 과 «안쪽 timeout» 을 둘 다 정리한다. 홈은 클라이언트 라우팅으로
    //    드나드는 곳이라 한쪽만 지우면 누수가 쌓인다.
    return () => {
      clearInterval(id);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [canRotate, open, q, rotateList.length]);

  // 회전이 멈춘 동안(타이핑·모달·reduced-motion) 문구가 사라진 채로 굳지 않게 되돌린다.
  useEffect(() => {
    if (!rotShown && (open || q)) setRotShown(true);
  }, [open, q, rotShown]);

  const heroText = canRotate ? rotateList[rotIdx] ?? placeholder : placeholder;

  /* ── H3-5 키보드 안내는 «키보드가 있는 기기» 에서만 ──
   * 모바일에는 ↑↓·Enter·ESC 가 없다. 안 되는 조작을 안내하면 화면만 좁아진다.
   * ⚠️ 브레이크포인트를 새로 만들지 않는다(§6) — pointer 특성으로 가른다.
   *    폭이 아니라 «입력 장치» 가 판단 기준이라 태블릿+키보드 같은 경우도 맞게 걸린다.
   * ⚠️ SSR 에서는 알 수 없으므로 첫 렌더에 숨기고 mount 후 켠다. 반대로 하면
   *    모바일에서 잠깐 보였다 사라진다.
   */
  const [hasKeyboard, setHasKeyboard] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(pointer: fine)");
    const sync = () => setHasKeyboard(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  /** 모달 추천 칩. 넘겨받은 목록이 있으면 그게 이기고, 없으면 기존 trending 을 쓴다. */
  const chips = suggestions && suggestions.length > 0 ? suggestions : trending;

  /**
   * H4-1 (b) — hero 의 «모달 밖» 추천 칩.
   *
   * 지금까지 추천 칩은 모달 안에만 있었다. 검색창을 눌러야 보이니 사실상 아무도 못 본다.
   * 홈 첫 화면에 그대로 노출해야 「무엇을 검색하는 곳인지」가 설명 없이 전달된다.
   *
   * ⚠️ trending 을 폴백으로 «쓰지 않는다». trending 은 모달을 열어야 채워지는 값이라
   *    폴백으로 두면 모달을 한 번 연 뒤부터 홈 첫 화면에 칩 줄이 갑자기 생긴다.
   *    hero 칩은 «넘겨받은 목록» 만 쓴다. 없으면 줄 자체를 렌더하지 않는다.
   */
  const heroChips = variant === "hero" ? (suggestions ?? []) : [];

  // ⌘K / Ctrl+K 단축키 — «여는» 쪽만 소유권이 갈린다(헤더에 인스턴스가 둘이라).
  useEffect(() => {
    if (!hotkey) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, openSearch]);

  /* ESC 는 «열려 있는 인스턴스» 가 소유한다 — hotkey 여부와 무관하다.
   * ⚠️ 전에는 ESC 가 ⌘K 리스너 안에 얹혀 있었다. 그래서 hotkey={false} 인
   *    모바일 아이콘 인스턴스는 «입력창에 포커스가 있을 때만» 닫혔다 —
   *    칩을 눌러 포커스가 옮겨 가면 ESC 가 아무 일도 하지 않았다. */
  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, closeSearch]);

  /* 닫힌 뒤 포커스 복원. 열 때 기억해 둔 자리로 돌려준다 —
   * 안 돌려주면 포커스가 <body> 로 떨어져 키보드 사용자가 헤더를 처음부터 훑어야 한다.
   * ⚠️ 결과를 눌러 라우팅한 경우에도 트리거(헤더 버튼)는 그대로 살아 있어 안전하다. */
  useEffect(() => {
    if (open) return;
    const el = restoreRef.current;
    restoreRef.current = null;
    if (el && el.isConnected) el.focus({ preventScroll: true });
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

  // 트렌딩 로드 (모달 열림 1회) — string[] 으로 정규화 (React #31 fix).
  // /api/search/trending 응답이 [{ keyword, heat_score }] 형태일 때 객체가 그대로
  // children 으로 박혀 "Objects are not valid as a React child" 폭발하던 버그.
  useEffect(() => {
    // H3-3: 추천 칩을 넘겨받았으면 trending 을 «부르지도» 않는다.
    // 쓰지 않을 응답을 위해 모달을 열 때마다 요청을 태울 이유가 없다.
    if (suggestions && suggestions.length > 0) return;
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
  }, [open, trending.length, suggestions]);

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
    closeSearch();
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
    closeSearch();
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
      closeSearch();
    }
  }

  return (
    <>
      {/* 헤더에 들어가는 trigger */}
      {variant === "icon" ? (
        <button
          type="button"
          onClick={openSearch}
          aria-label="검색 열기"
          // ⚠️ DS-3-4 — 헤더 아이콘 버튼은 36×36 이다. Rule #77 `.touch-target` 으로
          //    «히트 영역만» 44px 로 넓힌다 — 시각 크기를 키우면 헤더 높이가 밀린다.
          //    (그 주석이 globals.css 규칙 옆에 이미 적혀 있다. 붙이는 것을 빠뜨렸을 뿐이다.)
          className={['touch-target', className].filter(Boolean).join(' ')}
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
        <>
        {/* H1-1 홈 검색 히어로.
         * ⚠️ placeholder 를 16px 미만으로 내리지 말 것 — iOS 사파리가 입력창을
         *    자동 확대해 화면이 튄다. 홈 첫 화면이라 그 튐이 가장 잘 보인다. */}
        <button
          type="button"
          onClick={openSearch}
          aria-label="검색 열기"
          className={["kd-hero-search", tone === "dark" ? "kd-hero-search--dark" : "", className].filter(Boolean).join(" ")}
          style={{
            width: "100%",
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 16px",
            // H3-1: 첫 화면에서 «여기가 검색창이다» 를 색으로 알린다.
            // ⚠️ hex 를 직접 쓰지 않는다 — 그림자 rgba 만 예외다(토큰에 그림자 색이 없다).
            //    rgba(37,99,235) 는 --brand(#2563EB) 와 같은 값이다. 토큰을 바꾸면 여기도 본다.
            // H5-1 — 네이비 색면 위에서는 파란 테두리가 배경에 묻힌다. 흰 면만 남기고
            //   포커스 링을 골드로 준다(:focus-visible 은 CSS 라 클래스로 건다).
            border: tone === "dark" ? "0" : "2px solid var(--brand)",
            borderRadius: tone === "dark" ? 16 : "var(--radius-lg)",
            boxShadow: tone === "dark"
              ? "0 6px 20px rgba(0,0,0,0.22)"
              : "0 4px 14px rgba(37,99,235,0.16)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {/* SearchIcon 은 stroke="currentColor" 라 감싼 쪽의 color 를 따른다.
              버튼 전체 color 를 브랜드색으로 바꾸면 placeholder 글씨까지 파래지므로 아이콘만 감싼다. */}
          <span style={{ display: "flex", color: "var(--brand)" }}>
            <SearchIcon size={19} />
          </span>
          <span
            style={{
              flex: 1,
              // ⚠️ 16px 미만으로 내리지 말 것 (iOS 자동확대). 회전 문구도 이 자리에 들어간다.
              fontSize: 17,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              // 텍스트 교체 순간을 감추는 페이드. 회전하지 않을 때는 항상 1 이라
              // transition 이 걸려도 아무 일이 일어나지 않는다.
              opacity: rotShown ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease`,
            }}
          >
            {heroText}
          </span>
        </button>
        {/* H4-1 (b) — 검색창 바로 아래 칩 줄. 0개면 줄을 통째로 미렌더한다. */}
        {heroChips.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 5,
              margin: "8px 2px 0",
            }}
          >
            {/* 칩 라벨 500 — TY1 사다리(라벨·배지·칩). 자간은 14px 이하라 0.
                ⚠️ `width: "100%"` 로 «줄을 혼자 쓴다». 칩과 같은 줄에 두면 390px 에서
                   「라벨 + 칩 하나」로 끊겨, 그 칩 하나에만 붙은 설명처럼 읽힌다. */}
            {showSuggestionLabel && (
            <span
              style={{
                width: "100%",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: 0,
                lineHeight: 1.3,
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap",
              }}
            >
              {suggestionLabel}
            </span>
            )}
            {/* ⚠️ 칩 글씨는 줄여도 «검색어는 원문» 을 보낸다.
                shortSiteName 은 말줄임표를 쓰지 않는다 — 칩에서 '…' 는 눌러야 할지 알 수 없다. */}
            {heroChips.map((kw) => (
              <button
                key={`h-${kw}`}
                type="button"
                onClick={() => goToResultsPage(kw)}
                title={kw}
                // ⚠️ DS-3-4 — Rule #77. 히어로 칩은 그라디언트 위에 얹히므로
                //    높이를 키우면 히어로 구성이 흔들린다. 히트 영역만 넓힌다.
                className="touch-target"
                style={{
                  padding: "5px 10px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "var(--fs-2xs)",
                  fontWeight: 400,
                  letterSpacing: 0,
                  lineHeight: 1.2,
                  // H5-1 «칩 단색» — 반투명(흰 0.14)은 그라디언트 밝은 끝에서 흰 글씨가
                  //   4.03:1 로 미달했다(실측). 네이비 단색이면 어느 위치에서도 13.48:1 이다.
                  // ⚠️ 다만 «칩 면 vs 배경» 경계가 1.27~2.61 로 3:1 에 못 미친다 —
                  //   칩이 배경에 묻혀 「누를 수 있는 것」으로 안 보인다. 흰 테두리로 세운다.
                  //   0.45 → 2.51 ✗ / 0.55 → 3.27 / 0.6 → 3.6 OK (전 위치 최악값 기준).
                  background: tone === "dark" ? "var(--brand-navy)" : "var(--brand-bg)",
                  border: tone === "dark"
                    ? "1px solid rgba(255,255,255,0.6)"
                    : "1px solid var(--brand-border)",
                  // ⚠️ --brand(#2563EB) 는 light 배경에서 대비 4.65 라 400 굵기로 쓰기엔 얇다.
                  //    --brand-dark(#1E40AF) 는 7.84. 새 토큰을 만들지 않고 기존 것을 쓴다(TY1-2).
                  color: tone === "dark" ? "var(--text-inverse)" : "var(--brand-dark)",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                {shortSiteName(kw)}
              </button>
            ))}
          </div>
        )}
        </>
      ) : (
        <button
          type="button"
          onClick={openSearch}
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

      {/* 모달 — body 로 portal 한다.
       * ⛔ 여기서 «좌표를 밀어» 고치지 않는다. 기준 상자가 헤더인 것이 원인이고,
       *    그 원인은 헤더의 backdrop-filter 다(위 openSearch 주석). 헤더 밖으로 옮기면
       *    fixed 가 다시 뷰포트를 본다 — 폭마다 다른 보정값이 필요 없어진다.
       * ⚠️ z-index 는 «헤더(100) 위» 여야 한다. portal 로 나온 뒤에는 헤더와 같은
       *    루트 쌓임 맥락에 서므로 50 이면 헤더가 오버레이를 덮는다.
       *    9999 는 이 저장소의 기존 오버레이 층(Navigation 더보기 시트)과 같은 값이다.
       * ⛔ body 스크롤 잠금을 «걸지 않았다» — body 에 overflow:hidden 을 걸면
       *    이 사이트의 모든 sticky 가 죽는다(globals.css 의 실측 주석). 방어가 기능을 먹는 그 형태다.
       */}
      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="검색"
          onClick={closeSearch}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", flexDirection: "column", alignItems: "center",
            // 입력창은 «항상 헤더 아래» 에 선다. 값은 토큰 하나로만 산다 —
            // 헤더 높이가 바뀌면 그 토큰을 바꾸고, 자(search-overlay-audit)가 어긋남을 잡는다.
            padding: "var(--kd-overlay-top) var(--sp-md) var(--sp-md)",
            background: "rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{
              // 좁은 폭에서는 좌우 여백만 남는 «전폭 시트» 가 된다 — 폭 분기 없이
              // width:100% + max-width 하나로 두 모양이 다 나온다.
              width: "100%", maxWidth: 640,
              display: "flex", flexDirection: "column",
              // ⚠️ 세로는 «남은 높이만큼» 만 쓴다. 그래야 결과가 길어도 입력 줄이
              //    화면 밖으로 밀리지 않는다 — 이번 결함이 정확히 그 모양이었다.
              minHeight: 0, maxHeight: "100%", overflow: "hidden",
            }}
          >
            {/* 검색 입력 — ⛔ flexShrink:0. 패널이 커져도 이 줄은 «먼저» 자리를 갖는다. */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3" style={{ flexShrink: 0 }}>
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
                  // Rule #77 — 시각 크기는 그대로 두고 히트 영역만 44 로 넓힌다(§1-5 ②).
                  className="touch-target text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 결과 패널 — 입력 줄 «아래» 에서 남은 높이를 받아 자기 안에서 스크롤한다. */}
            <div className="overflow-y-auto p-2" style={{ flex: "1 1 auto", minHeight: 0 }}>
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
                            className="touch-target rounded-full bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200"
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chips.length > 0 && (
                    <div>
                      {/* ⚠️ 라벨이 비면 제목을 «렌더하지 않는다». 홈이 칩 소스에 따라
                          라벨을 갈아 끼우는데(H4-1 d), 소스가 0건이면 빈 문자열이 온다.
                          그때 <h3> 를 그대로 두면 빈 제목 줄이 남는다. */}
                      {suggestionLabel && (
                        <h3 className="mb-2 text-xs font-bold text-gray-500">{suggestionLabel}</h3>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {/* ⚠️ 칩 글씨는 줄여도 «검색어는 원문» 을 보낸다.
                            '센트레빌 거제' 로 검색하면 결과가 나오지 않는다. */}
                        {chips.map((kw) => (
                          <button
                            key={`t-${kw}`}
                            onClick={() => goToResultsPage(kw)}
                            title={kw}
                            className="touch-target rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
                          >
                            {shortSiteName(kw)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasKeyboard && (
                    <div className="px-1 pt-2 text-[11px] text-gray-400">
                      ↑↓ 선택 · Enter 이동 · ESC 닫기
                    </div>
                  )}
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
        </div>,
        document.body,
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
          className="touch-target mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-xs text-gray-700 hover:bg-gray-50"
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
