import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.05,
    environment: process.env.NODE_ENV,
    debug: false,
    beforeSend(event) {
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) return null;
      return event;
    },
  });
}
