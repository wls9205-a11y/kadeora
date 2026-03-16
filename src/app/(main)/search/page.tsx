import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchClient from './SearchClient';

export const metadata: Metadata = {
  title: '검색 | 카더라',
  description: '카더라 통합 검색 — 게시글, 종목, 토론방 검색',
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '60px 0' }}>로딩 중...</div>}>
      <SearchClient />
    </Suspense>
  );
}
