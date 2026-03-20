'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>😵</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>페이지를 불러오지 못했어요</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
        일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={reset} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: 'var(--text-inverse)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          🔄 다시 시도
        </button>
        <Link href="/feed" style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', display: 'inline-block' }}>
          📰 피드로
        </Link>
      </div>
    </div>
  );
}