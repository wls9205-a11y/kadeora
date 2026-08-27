'use client';
/**
 * H5-1 — 홈 히어로. 첫 화면의 주인공은 «검색창» 이다.
 *
 * ── 왜 색면인가 ─────────────────────────────────────────────────────────────
 * 흰 배경에 검색창 하나만 두면 「검색창이 있는 페이지」로 읽힌다. 첫 화면의 절반을
 * 브랜드 색면이 차지하면 「검색하는 곳」이 된다. 그래서 높이를 뷰포트 비율로 잡는다.
 *
 * ⚠️ `svh` 를 쓴다. iOS 사파리는 주소창이 접히고 펴지면서 `vh` 가 «점프» 한다 —
 *    첫 화면에서 검색창이 하단 바에 가렸다 나타났다 한다. `svh` 는 작은 쪽(주소창이
 *    펼쳐진 상태)으로 고정되므로 검색창이 «항상» 보인다.
 *
 * ⛔ UniversalSearchBar 를 다시 만들지 않았다. 톤 프롭만 넘긴다 —
 *    검색 동작·모달·⌘K·회전 문구는 전부 그대로다.
 *
 * ⚠️ hotkey={false} 필수. 헤더의 bar 인스턴스가 이미 ⌘K 를 소유한다.
 *    둘 다 true 면 keydown 이 두 번 잡혀 모달이 두 개 열린다.
 *
 * ── 대비 (실측 · docs/m6/H5_대비실측.md 방식) ───────────────────────────────
 * 히어로는 단색이 아니라 그라디언트다. 위치마다 배경이 다르므로 «글자가 놓이는
 * 자리의 배경» 으로 재야 한다. 720×520 기준, 광원(radial)까지 합성한 값:
 *
 *   1줄 흰   7.87 · 2줄 흰   8.56 · 3줄 «골드» 5.82   ← 셋 다 상단 1/3 안
 *   칩 면 위 흰 글씨 13.48 (네이비 단색이라 위치와 무관)
 *
 * ⛔ 골드 줄을 아래로 내리지 말 것. 그라디언트 끝점(#2563EB)에서 골드는 3.27:1 이다.
 *    카피 블록을 상단 1/3 에 «고정» 하는 것이 이 화면의 대비 조건이다.
 */

import { useEffect, useRef, useState } from 'react';
import UniversalSearchBar from '@/components/search/UniversalSearchBar';

/** 3.5초 간격으로 도는 플레이스홀더. ⚠️ SSR 첫 값은 고정 — 서버·클라이언트가 갈리면 hydration 이 깨진다. */
const ROTATION = ['엄궁역', '해운대구 재개발', '분양가', '단지명'];
const ROTATE_MS = 3500;

/** H6-4 데이터 띠 한 칸. 숫자가 «없으면» 그 칸을 만들지 않는다. */
export interface HeroStat {
  /** 숫자 부분만. 라벨과 분리해야 굵기를 다르게 줄 수 있다. */
  value: string;
  label: string;
  href: string;
}

export default function HeroSearch({
  chipNames,
  siteCount,
  stats = [],
}: {
  /** buildHomeChips 결과. 라벨은 «내지 않는다» — 순위를 주장하는 라벼 금지. */
  chipNames: string[];
  siteCount: number;
  /**
   * H6-4 — 히어로 하단 데이터 띠.
   *
   * ⚠️ 이미지·일러스트로 채우지 «않는다». 실사 정책과 대비 규칙 둘 다에 걸린다.
   *    빈 색면을 데이터로 채우면 그 자체가 사이트가 무엇을 아는지 보여 준다.
   * ⚠️ 히어로의 «일부» 다 — 별도 네이비 덩어리가 아니다(§1-6).
   * ⛔ 개인 데이터(최근 본 현장)를 여기 올리지 않는다.
   */
  stats?: HeroStat[];
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const [rotIdx, setRotIdx] = useState(0);

  /* 플레이스홀더 회전. reduced-motion 이면 돌리지 않는다 — 글자가 바뀌는 것도 모션이다. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setRotIdx((i) => (i + 1) % ROTATION.length), ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  /* Sticky 전환 — 히어로 높이 − 80px 를 지나면 히어로 인스턴스를 숨긴다.
   *
   * ⚠️ 헤더 검색은 이미 모든 페이지에 떠 있다. 여기서 하는 일은 «히어로 쪽을 치우는 것»
   *    뿐이다. 두 인스턴스가 동시에 포커스 가능하면 Tab 순서가 두 벌이 된다.
   * ⚠️ 그래서 visibility:hidden «과» inert 를 같이 건다. opacity 만 0 으로 두면
   *    보이지 않는 검색창에 Tab 이 들어가고 스크린리더도 읽는다.
   * ⚠️ scroll 이 아니라 IntersectionObserver 를 쓴다. scroll 핸들러는 프레임마다
   *    돌아 첫 화면에서 가장 비싼 자리에 부하를 얹는다. */
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        setHidden(!e.isIntersecting);
        /* ⚠️ 헤더가 이 신호를 읽는다. «보일 때 표시» 로 두는 것이 중요하다 —
         *    JS 가 죽으면 속성이 안 붙고, 그러면 헤더 검색이 «보이는» 쪽으로 떨어진다.
         *    반대로 「숨을 때 표시」로 두면 JS 가 죽었을 때 모바일 홈에 검색이 0개가 된다.
         *    실패는 「검색이 둘」쪽으로 나야지 「검색이 없음」쪽으로 나면 안 된다. */
        if (e.isIntersecting) document.documentElement.dataset.heroVisible = 'true';
        else delete document.documentElement.dataset.heroVisible;
      },
      { rootMargin: '-80px 0px 0px 0px', threshold: 0 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete document.documentElement.dataset.heroVisible;   // 홈을 떠나면 반드시 지운다
    };
  }, []);

  return (
    <section
      ref={ref}
      className="kd-home-hero"
      data-hidden={hidden ? 'true' : undefined}
      // inert 는 React 19 에서 boolean 프롭이다. 숨은 동안 포커스·읽기를 통째로 막는다.
      inert={hidden}
      aria-label="현장 검색"
    >
      <div className="kd-home-hero__inner">
        {/* 카피 3줄 — 셋째 줄만 골드. 상단 1/3 안에 들어가야 대비가 성립한다. */}
        <h1 className="kd-home-hero__copy">
          아직 시작 안 한 현장까지
          <br />
          분양 소식을
          <br />
          <span className="kd-home-hero__gold">가장 먼저</span>
        </h1>

        <div className="kd-home-hero__search">
          <UniversalSearchBar
            variant="hero"
            tone="dark"
            hotkey={false}
            showSuggestionLabel={false}
            placeholder={ROTATION[0]}
            rotatingPlaceholders={[ROTATION[rotIdx]]}
            suggestions={chipNames}
          />
        </div>

        {siteCount > 0 && (
          <p className="kd-home-hero__meta">현장 {siteCount.toLocaleString('ko-KR')}곳</p>
        )}

        {/* 데이터 띠 — 히어로 하단. ⛔ 골드를 쓰지 않는다(그라디언트 끝점 3.27).
            흰 / --brand-navy-mid 단색은 10.36 이다. */}
        {stats.length > 0 && (
          <div className="kd-home-hero__stats">
            {stats.map((s) => (
              <a key={s.label} href={s.href} className="kd-home-hero__stat">
                <span className="kd-home-hero__stat-v">{s.value}</span>
                <span className="kd-home-hero__stat-l">{s.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
