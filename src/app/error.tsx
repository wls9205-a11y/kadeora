'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>문제가 발생했습니다</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 'var(--fs-base)' }}>잠시 후 다시 시도해주세요</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-base)', cursor: 'pointer' }}>다시 시도</button>
          <Link href="/feed" style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', textDecoration: 'none' }}>홈으로</Link>
        </div>
      </div>
    </div>
  );
}
