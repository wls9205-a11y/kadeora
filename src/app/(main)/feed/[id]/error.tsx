'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 'var(--sp-lg)', padding: 24, textAlign: 'center' }}>
      <span style={{ fontSize: 'var(--fs-2xl)' }}>😵</span>
      <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>페이지를 불러오지 못했어요</h2>
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--fs-base)' }}>네트워크 상태를 확인하고 다시 시도해주세요</p>
      <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
        <button onClick={reset} style={{ backgroundColor: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-full)', padding: 'var(--sp-md) var(--sp-2xl)', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--fs-base)' }}>다시 시도</button>
        <Link href="/feed" style={{ padding: 'var(--sp-md) var(--sp-2xl)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-base)', fontWeight: 600, textDecoration: 'none' }}>홈으로</Link>
      </div>
    </div>
  );
}
