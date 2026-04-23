'use client';
/**
 * 세션 146/150/151 — Core Web Vitals 수집 + CLS Attribution.
 *
 * 세션 151 수정:
 * - PerformanceObserver 초기화를 useEffect → 모듈 로드 즉시로 이동 (hydration 지연 제거)
 * - LayoutShift.sources 배열이 비어있을 때 fallback selector (document.body, active element)
 * - INP attribution target 수집 추가
 */
import { useReportWebVitals } from 'next/web-vitals';

function rateFor(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  switch (name) {
    case 'LCP': return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'CLS': return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'INP': return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
    case 'TTFB': return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    case 'FCP': return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    default: return 'good';
  }
}

function selectorFor(el: Element | null | undefined): string | null {
  if (!el || typeof el !== 'object') return null;
  try {
    const h = el as HTMLElement;
    if (h.id) return `#${h.id}`;
    const cls = typeof h.className === 'string' ? h.className : '';
    const classPart = cls ? '.' + cls.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const tag = el.tagName ? el.tagName.toLowerCase() : 'unknown';
    return `${tag}${classPart}`.slice(0, 200);
  } catch { return null; }
}

// 모듈 레벨 상태 — 브라우저 로드 시점 초기화 (hydration 대기 X)
let largestShiftValue = 0;
let largestShiftTarget: string | null = null;
let lastShiftBodyFallback: string | null = null;
let lcpElement: string | null = null;
let inpTargetLast: string | null = null;

if (typeof window !== 'undefined' && typeof PerformanceObserver !== 'undefined') {
  // CLS observer
  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.hadRecentInput) continue;
        if (typeof entry.value !== 'number') continue;
        if (entry.value > largestShiftValue) {
          largestShiftValue = entry.value;
          const sources = Array.isArray(entry.sources) ? entry.sources : [];
          // 첫 번째 source.node 우선, 없으면 fallback
          let picked: Element | null = null;
          for (const s of sources) {
            if (s?.node) { picked = s.node as Element; break; }
          }
          largestShiftTarget = selectorFor(picked) || lastShiftBodyFallback || '(unknown)';
        }
      }
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });
  } catch {}

  // LCP observer
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries() as any[];
      const last = entries[entries.length - 1];
      if (last?.element) lcpElement = selectorFor(last.element);
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  // INP target (event-timing) — FID/INP 목표 엘리먼트 기록
  try {
    const evtObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.duration >= 40 && entry.target) {
          inpTargetLast = selectorFor(entry.target as Element);
        }
      }
    });
    evtObs.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any);
  } catch {}

  // fallback: document.body 가 있으면 기본값으로 저장
  const setBodyFallback = () => {
    try { lastShiftBodyFallback = selectorFor(document.body); } catch {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setBodyFallback, { once: true });
  } else {
    setBodyFallback();
  }
}

export default function VitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof window === 'undefined') return;
    const payload: Record<string, unknown> = {
      page_path: window.location.pathname,
      metric_name: metric.name,
      value: metric.value,
      rating: rateFor(metric.name, metric.value),
      device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    };
    if (metric.name === 'CLS') {
      payload.cls_largest_shift_target = largestShiftTarget || lastShiftBodyFallback || 'unknown';
      payload.cls_largest_shift_value = Math.round(largestShiftValue * 10000) / 10000;
    }
    if (metric.name === 'LCP' && lcpElement) {
      payload.lcp_element = lcpElement;
    }
    if (metric.name === 'INP' && inpTargetLast) {
      payload.inp_target = inpTargetLast;
    }
    try {
      const body = JSON.stringify(payload);
      // 세션 151: sendBeacon 는 application/json Blob 에서 Chrome/Safari 차이 — text/plain 우선
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/web-vitals', new Blob([body], { type: 'text/plain' }));
      } else {
        fetch('/api/web-vitals', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
      }
    } catch {}
  });
  return null;
}
