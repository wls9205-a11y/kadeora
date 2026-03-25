import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '청약 가점 진단 | 카더라',
  description: '나의 청약 가점을 계산하고 당첨 가능성을 진단해보세요. 무주택 기간, 부양가족, 청약통장 기간별 점수 자동 계산.',
  alternates: { canonical: 'https://kadeora.app/apt/diagnose' },
  robots: { index: true, follow: true },
};

export default function DiagnoseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
