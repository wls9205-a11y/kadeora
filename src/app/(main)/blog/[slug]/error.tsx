'use client';
import Link from 'next/link';

export default function BlogDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
      <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>글을 불러오지 못했어요</h2>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-tertiary)', marginBottom: 20 }}>잠시 후 다시 시도해주세요</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={reset} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer' }}>
          다시 시도
        </button>
        <Link href="/blog" style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--brand)', color: '#fff', fontSize: 'var(--fs-base)', fontWeight: 600, textDecoration: 'none' }}>
          블로그 목록
        </Link>
      </div>
    </div>
  );
}
