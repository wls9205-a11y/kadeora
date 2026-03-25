import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '종목 비교',
  description: '두 종목의 시가총액·등락률·거래량을 한눈에 비교해보세요. KOSPI, KOSDAQ 전 종목 지원.',
  alternates: { canonical: 'https://kadeora.app/stock/compare' },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
