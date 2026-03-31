'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 'var(--sp-lg)', padding: 24, textAlign: 'center' }}>
      <span style={{ fontSize: 'var(--fs-2xl)' }}>📊</span>
      <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>주식 정보를 불러오지 못했어요</h2>
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--fs-base)' }}>잠시 후 다시 시도해주세요</p>
      <button onClick={reset} style={{ backgroundColor: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-full)', padding: 'var(--sp-md) var(--sp-2xl)', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--fs-base)' }}>다시 시도</button>
    </div>
  );
}
