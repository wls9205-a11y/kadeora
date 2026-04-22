'use client';

/**
 * SimilarAptsTracker — SimilarAptsSection 의 3번째 카드(index 2) view/click 로깅.
 *
 * C3 spec:
 *   mount 시 event='viewed_3rd_locked' INSERT to apt_compare_unlock_logs
 *   3번째 카드 클릭 시 event='clicked_3rd_cta'
 *
 * sendBeacon text/plain 호환. 서버 /api/events/apt-compare-unlock 에서 파싱.
 */

import { useEffect, useRef } from 'react';

interface Props {
  aptSiteId: string;
  thirdCardId?: string | null;
}

function visitorId(): string {
  if (typeof document === 'undefined') return '';
  const KEY = 'kd_vid';
  try {
    const match = document.cookie.split('; ').find((c) => c.startsWith(KEY + '='));
    if (match) return decodeURIComponent(match.split('=')[1] || '');
  } catch { /* silent */ }
  return '';
}

function sendEvent(event: string, aptSiteId: string) {
  const body = JSON.stringify({ event, apt_site_id: aptSiteId, visitor_id: visitorId() });
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/events/apt-compare-unlock', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/events/apt-compare-unlock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body, keepalive: true,
      }).then(() => {}, () => {});
    }
  } catch { /* silent */ }
}

export default function SimilarAptsTracker({ aptSiteId, thirdCardId }: Props) {
  const viewFired = useRef(false);

  useEffect(() => {
    if (viewFired.current || !aptSiteId) return;
    viewFired.current = true;
    sendEvent('viewed_3rd_locked', aptSiteId);
  }, [aptSiteId]);

  useEffect(() => {
    if (typeof document === 'undefined' || !aptSiteId) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const card = target.closest('a[data-similar-apt-card]') as HTMLAnchorElement | null;
      if (!card) return;
      const idx = Number(card.getAttribute('data-similar-idx') || '-1');
      if (idx === 2) sendEvent('clicked_3rd_cta', aptSiteId);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [aptSiteId, thirdCardId]);

  return null;
}
