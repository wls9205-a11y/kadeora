'use client';
// s262 Phase E — Embla 기반 swipe carousel (RSC compatible).
// 페이지가 server 측에서 N개 슬라이드 노드를 children 으로 전달.
// 각 슬라이드는 자체 렌더 (lazy mount 안 함 — RSC closure 제약 회피, 데이터 사이즈 작음).
// URL sync: history.replaceState (push 금지 — Rule #87).
// 좌/우 키보드 ←/→ fallback. iOS overscroll lock.

import { Children, useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import CarouselDots from './CarouselDots';
import { trackSwipe } from '@/lib/cta-track';

type TabDef = { key: string; label: string };

type Props = {
  tabs: TabDef[];
  initialIndex?: number;
  paramName?: string;
  paramDefault?: string;
  trackSource?: string; // trackSwipe category 용 (e.g. 'stock_carousel')
  children: React.ReactNode; // tabs.length 개수만큼
};

export default function StockTabCarousel({
  tabs,
  initialIndex = 0,
  paramName = 'tab',
  paramDefault,
  trackSource,
  children,
}: Props) {
  const slides = Children.toArray(children);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    skipSnaps: false,
    startIndex: initialIndex,
    loop: false,
  });
  const [active, setActive] = useState(initialIndex);
  const lastKeyRef = useRef(tabs[initialIndex]?.key ?? '');

  const updateUrl = useCallback((newKey: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (newKey === paramDefault) url.searchParams.delete(paramName);
    else url.searchParams.set(paramName, newKey);
    window.history.replaceState(window.history.state, '', url.toString());
  }, [paramName, paramDefault]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      const newKey = tabs[idx]?.key ?? '';
      const oldKey = lastKeyRef.current;
      setActive(idx);
      if (newKey !== oldKey) {
        updateUrl(newKey);
        if (trackSource) trackSwipe({ source: trackSource, from_tab: oldKey, to_tab: newKey });
        lastKeyRef.current = newKey;
      }
    };
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, tabs, updateUrl, trackSource]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!emblaApi) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); emblaApi.scrollPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); emblaApi.scrollNext(); }
  }, [emblaApi]);

  const jumpTo = useCallback((i: number) => {
    if (emblaApi) emblaApi.scrollTo(i);
  }, [emblaApi]);

  return (
    <div onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* V4-2 — 필 → 언더라인 «구조» 교체(판정회신 증분1 ②).
          모양은 .kd-utab 한 벌이 진다. StockFilterBars 시장 축과 «같은 클래스» 다 —
          탭 문법이 화면마다 갈리던 것이 이번 리뉴얼의 발단이다.
          ⚠️ 여기서 배경을 rgba(255,255,255,.92) + backdrop-filter 로 두던 것을 버렸다.
             backdrop-filter 는 position:fixed 자손의 «기준 상자» 를 만든다 — 결함 1호가
             바로 그 사고였다. .kd-utabs 는 불투명 배경만 쓴다.
          role=tab / aria-selected 체계는 그대로다. */}
      <nav role="tablist" aria-label="carousel tabs" className="kd-utabs" style={{ margin: '0 -6px 4px' }}>
        {tabs.map((t, i) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={i === active}
            onClick={() => jumpTo(i)}
            className="kd-utab"
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div
        ref={emblaRef}
        style={{ overflow: 'hidden', touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
      >
        <div style={{ display: 'flex' }}>
          {slides.map((slide, i) => (
            <div
              key={tabs[i]?.key ?? i}
              role="tabpanel"
              aria-label={tabs[i]?.label}
              style={{ flex: '0 0 100%', minWidth: 0 }}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      <CarouselDots count={tabs.length} active={active} onJump={jumpTo} />
    </div>
  );
}
