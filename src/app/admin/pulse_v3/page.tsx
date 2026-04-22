import { Suspense } from 'react';
import PulseV3Client from './PulseV3Client';

export const dynamic = 'force-dynamic';

export default function PulseV3Page() {
  return (
    <Suspense fallback={<div style={{ padding: 20, color: 'rgba(255,255,255,0.5)' }}>로딩 중…</div>}>
      <PulseV3Client />
    </Suspense>
  );
}
