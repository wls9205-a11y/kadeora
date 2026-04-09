'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView, trackPageLeave, trackScroll } from '@/lib/analytics';

/**
 * BehaviorTracker — 자동 행동 추적
 * 
 * 1. 페이지 진입/이탈 + 체류 시간
 * 2. 스크롤 깊이 (25%, 50%, 75%, 100%)
 * 3. 탭 전환 시 자동 이탈 기록
 * 
 * layout.tsx에 한 번만 배치하면 전 페이지 자동 추적
 */
export default function BehaviorTracker() {
  const pathname = usePathname();
  const enterTime = useRef(Date.now());
  const scrollMilestones = useRef(new Set<number>());

  useEffect(() => {
    // 페이지 진입
    enterTime.current = Date.now();
    scrollMilestones.current.clear();
    trackPageView(pathname);

    // 스크롤 깊이 추적
    const handleScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      if (scrollHeight <= 0) return;

      const depth = Math.round((scrollTop / scrollHeight) * 100);
      const milestones = [25, 50, 75, 100];
      for (const m of milestones) {
        if (depth >= m && !scrollMilestones.current.has(m)) {
          scrollMilestones.current.add(m);
          trackScroll(m);
        }
      }
    };

    // throttle: 500ms
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const throttledScroll = () => {
      if (!scrollTimer) {
        scrollTimer = setTimeout(() => {
          scrollTimer = null;
          handleScroll();
        }, 500);
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });

    // 이탈 시 체류 시간 기록
    return () => {
      window.removeEventListener('scroll', throttledScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
      const duration = Date.now() - enterTime.current;
      if (duration > 1000) { // 1초 이상만 기록
        trackPageLeave(duration);
      }
    };
  }, [pathname]);

  return null;
}
