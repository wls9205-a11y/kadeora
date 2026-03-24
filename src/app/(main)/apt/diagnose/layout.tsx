import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '아파트 AI 진단 | 카더라',
  description: '관심 아파트의 투자 가치를 AI가 분석해드립니다. 실거래가, 미분양, 재개발 현황 종합 진단.',
  robots: { index: true, follow: true },
};

export default function DiagnoseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
