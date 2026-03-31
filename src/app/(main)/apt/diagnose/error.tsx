'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 'var(--sp-md)' }}>😵</div>
      <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>페이지를 불러오지 못했어요</h2>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-xl)' }}>잠시 후 다시 시도해주세요</p>
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'center' }}>
        <button onClick={reset} style={{ padding: 'var(--sp-md) var(--sp-xl)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer' }}>
          다시 시도
        </button>
        <Link href="/feed" style={{ padding: 'var(--sp-md) var(--sp-xl)', borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: 'var(--text-inverse)', fontSize: 'var(--fs-sm)', fontWeight: 600, textDecoration: 'none' }}>
          홈으로
        </Link>
      </div>
    </div>
  );
}
