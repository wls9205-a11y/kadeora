import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '부동산 진단',
  description: '아파트 투자 진단 — 청약·미분양·재개발 데이터 기반 분석',
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
