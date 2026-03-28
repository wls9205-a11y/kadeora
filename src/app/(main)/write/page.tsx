import type { Metadata } from 'next';
import { Suspense } from 'react';
import WriteClient from './WriteClient';

export const metadata: Metadata = {
  title: '글쓰기',
  description: '카더라 커뮤니티에 글을 작성하세요. 주식, 부동산, 재테크 등 다양한 주제로 소통하세요.',
  robots: { index: false, follow: true },
};

export default function WritePage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '60px 0' }}>로딩 중...</div>}>
      <WriteClient />
    </Suspense>
  );
}
