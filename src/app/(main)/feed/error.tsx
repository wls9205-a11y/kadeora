'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 16, padding: 24, textAlign: 'center' }}>
      <span style={{ fontSize: 48 }}>📋</span>
      <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>피드를 불러오지 못했어요</h2>
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>네트워크 상태를 확인하고 다시 시도해주세요</p>
      <button onClick={reset} style={{ backgroundColor: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 9999, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>다시 시도</button>
    </div>
  );
}
