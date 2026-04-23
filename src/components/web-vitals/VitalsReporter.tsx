'use client';
/**
 * 세션 146/150 — Core Web Vitals 수집 + CLS Attribution (native PerformanceObserver).
 * Next useReportWebVitals + 자체 layout-shift / largest-contentful-paint observer.
 */
import { useEffect } from 'react';
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

function selectorFor(el: Element | null): string | null {
  if (!el) return null;
  try {
    if ((el as HTMLElement).id) return `#${(el as HTMLElement).id}`;
    const cls = (el as HTMLElement).className;
    const classPart = typeof cls === 'string' && cls ? '.' + cls.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${classPart}`.slice(0, 200);
  } catch { return null; }
}

// 모듈 레벨 state — CLS 최대 shift 추적
let largestShiftValue = 0;
let largestShiftTarget: string | null = null;
let lcpElement: string | null = null;

function initAttributionObservers() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.hadRecentInput) continue;
        if (entry.value > largestShiftValue) {
          largestShiftValue = entry.value;
          const sources = entry.sources || [];
          const firstNode = sources[0]?.node as Element | null;
          largestShiftTarget = selectorFor(firstNode);
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {}

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries() as any[];
      const last = entries[entries.length - 1];
      if (last?.element) lcpElement = selectorFor(last.element);
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
}

export default function VitalsReporter() {
  useEffect(() => { initAttributionObservers(); }, []);

  useReportWebVitals((metric) => {
    if (typeof window === 'undefined') return;
    const payload: Record<string, unknown> = {
      page_path: window.location.pathname,
      metric_name: metric.name,
      value: metric.value,
      rating: rateFor(metric.name, metric.value),
      device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    };
    if (metric.name === 'CLS' && largestShiftTarget) {
      payload.cls_largest_shift_target = largestShiftTarget;
      payload.cls_largest_shift_value = Math.round(largestShiftValue * 10000) / 10000;
    }
    if (metric.name === 'LCP' && lcpElement) {
      payload.lcp_element = lcpElement;
    }
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
