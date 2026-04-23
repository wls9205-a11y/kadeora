'use client';
/**
 * 세션 146 — Core Web Vitals 수집.
 * Next.js 15 useReportWebVitals 훅으로 web-vitals 추가 패키지 없이 LCP/CLS/INP/TTFB/FCP 수집.
 * sendBeacon 으로 /api/web-vitals 에 전송, 실패 시 fetch keepalive.
 */
import { useReportWebVitals } from 'next/web-vitals';

function rateFor(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  // Web Vitals thresholds (Google 기준, 2024)
  switch (name) {
    case 'LCP': return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'CLS': return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'INP': return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
    case 'TTFB': return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    case 'FCP': return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    default: return 'good';
  }
}

export default function VitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof window === 'undefined') return;
    const payload = {
      page_path: window.location.pathname,
      metric_name: metric.name,
      value: metric.value,
      rating: rateFor(metric.name, metric.value),
      device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    };
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/web-vitals', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/web-vitals', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
      }
    } catch {}
  });
  return null;
}
