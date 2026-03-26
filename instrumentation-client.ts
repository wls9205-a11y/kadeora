import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && dsn.startsWith('https://')) {
Sentry.init({
  dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],
  ignoreErrors: [
    /extensions\//i, /chrome-extension/i,
    "Network request failed", "Failed to fetch", "Load failed", "AbortError",
    "NEXT_REDIRECT", "NEXT_NOT_FOUND",
    "ResizeObserver loop", "Non-Error exception",
  ],
  beforeSend(event) {
    // 페이지 URL 컨텍스트 자동 추가
    if (typeof window !== 'undefined') {
      event.tags = { ...event.tags, page: window.location.pathname };
    }
    return event;
  },
});
}

// Next.js navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
