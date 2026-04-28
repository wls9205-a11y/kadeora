'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function PageViewTracker() {
  const pathname = usePathname();

  // Service Worker 등록 (푸시 알림 전제조건 — 최초 1회)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!pathname) return;
    try {
      let vid = localStorage.getItem('kd_visitor_id');
      if (!vid) {
        vid = crypto.randomUUID();
        localStorage.setItem('kd_visitor_id', vid);
      }
      const body = JSON.stringify({ visitor_id: vid, path: pathname, referrer: document.referrer || null });
      const sent = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
        && navigator.sendBeacon('/api/analytics/pageview', new Blob([body], { type: 'application/json' }));
      if (!sent) {
        fetch('/api/analytics/pageview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }

      // GA4 SPA 페이지뷰 추적
      const w = window as any;
      if (typeof w.gtag === 'function') {
        w.gtag('event', 'page_view', {
          page_path: pathname,
          page_location: `https://kadeora.app${pathname}`,
        });
      }
    } catch {}
  }, [pathname]);

  return null;
}
