'use client';

/**
 * CtaGlobalTracker — 전역 a[href*="/login?"] 클릭 이벤트 캡처 + conversion_events 전송
 *
 * 개별 CTA 컴포넌트에 onClick 을 일일이 추가하지 않아도 /login?source=xxx 링크를 통과하는
 * 모든 CTA 가 자동 추적. body 루트에 한 번만 마운트.
 */

import { useEffect } from 'react';
import { trackCtaClick } from '@/lib/cta-track';

export default function CtaGlobalTracker() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href) return;
      try {
        const u = new URL(href, window.location.origin);
        if (u.pathname !== '/login') return;
        const source = u.searchParams.get('source');
        if (!source) return;
        trackCtaClick({
          cta_name: source,
          category: 'signup',
          page_path: window.location.pathname,
        });
      } catch { /* silent */ }
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);
  return null;
}
