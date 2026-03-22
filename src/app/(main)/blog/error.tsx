'use client';
import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>😵</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>페이지를 불러오지 못했어요</h2>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 20 }}>잠시 후 다시 시도해주세요</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={reset} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          다시 시도
        </button>
        <Link href="/feed" style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          홈으로
        </Link>
      </div>
    </div>
  );
}
