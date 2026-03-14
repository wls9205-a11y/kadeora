"use client";

/**
 * Osmani: "Web Vitals 측정 코드 없음 — @vercel/analytics 패키지가 없다"
 * Analytics + Speed Insights 통합 컴포넌트
 */

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export function VercelAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
