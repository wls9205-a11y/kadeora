import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  ignoreErrors: [
    /extensions\//i, /chrome-extension/i,
    "Network request failed", "Failed to fetch", "Load failed", "AbortError",
    "NEXT_REDIRECT", "NEXT_NOT_FOUND",
  ],
});
