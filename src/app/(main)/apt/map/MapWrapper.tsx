'use client';
import dynamic from 'next/dynamic';

const MapClient = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
      지도를 불러오는 중...
    </div>
  ),
});

export default function MapWrapper() {
  return <MapClient />;
}
