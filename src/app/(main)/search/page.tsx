import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { Suspense } from 'react';
import SearchClient from './SearchClient';

export const metadata: Metadata = {
  title: '검색',
  description: '카더라 통합 검색 — 게시글, 종목, 토론방 검색',
  alternates: { canonical: SITE_URL + '/search' },
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '60px 0' }}>로딩 중...</div>}>
      <SearchClient />
    </Suspense>
  );
}
