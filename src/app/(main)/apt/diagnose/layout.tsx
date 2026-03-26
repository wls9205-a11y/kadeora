import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '청약 가점 진단',
  description: '내 청약 가점을 계산해보세요. 무주택기간, 부양가족, 청약통장 기간별 점수 자동 계산.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
