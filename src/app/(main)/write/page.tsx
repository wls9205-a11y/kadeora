import type { Metadata } from 'next';
import { Suspense } from 'react';
import WriteClient from './WriteClient';

export const metadata: Metadata = { title: '글쓰기 | 카더라', robots: { index: false, follow: false } };

export default function WritePage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '60px 0' }}>로딩 중...</div>}>
      <WriteClient />
    </Suspense>
  );
}
