import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: '종목 비교 | 카더라',
  description: '두 종목을 나란히 비교하세요. 시가총액, 등락률, 거래량, 섹터 한눈에 비교.',
  alternates: { canonical: 'https://kadeora.app/stock/compare' },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>로딩 중...</div>}>{children}</Suspense>;
}
