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
      {/* Tab pills */}
      <nav
        role="tablist"
        aria-label="carousel tabs"
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          padding: '8px 6px', margin: '0 -6px 4px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {tabs.map((t, i) => {
          const isActive = i === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => jumpTo(i)}
              style={{
                padding: '5px 10px', borderRadius: 'var(--radius-pill)',
                fontSize: 'var(--fs-2xs)', fontWeight: isActive ? 600 : 500,
                // ✅ DS-3 전 화면 실측 후 --surface-inverse 를 신설해 «의미를 맞췄다»(2026-08-29).
                //    이전에는 --text-primary 를 배경으로 썼다 — 색은 맞고 의미는 어긋난 흡수였다.
                background: isActive ? 'var(--surface-inverse)' : 'var(--bg-elevated)',
                color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
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
