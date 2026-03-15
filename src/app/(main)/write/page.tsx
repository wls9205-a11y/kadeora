import { Suspense } from 'react';
import WriteClient from './WriteClient';

export default function WritePage() {
  return (
    <Suspense fallback={<div style={{ color: '#94A3B8', textAlign: 'center', padding: '60px 0' }}>로딩 중...</div>}>
      <WriteClient />
    </Suspense>
  );
}
