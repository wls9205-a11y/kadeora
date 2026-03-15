import { Suspense } from 'react';
import SearchClient from './SearchClient';

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ color: '#94A3B8', textAlign: 'center', padding: '60px 0' }}>로딩 중...</div>}>
      <SearchClient />
    </Suspense>
  );
}
