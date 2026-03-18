'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    try {
      let vid = localStorage.getItem('kd_visitor_id');
      if (!vid) {
        vid = crypto.randomUUID();
        localStorage.setItem('kd_visitor_id', vid);
      }
      fetch('/api/analytics/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: vid, path: pathname, referrer: document.referrer || null }),
      }).catch(() => {});
    } catch {}
  }, [pathname]);

  return null;
}
