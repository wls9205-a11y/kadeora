import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '종목 비교',
  description: '국내외 주식 종목을 나란히 비교해보세요. 시가총액, 등락률, 거래량 등 핵심 지표 비교.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
