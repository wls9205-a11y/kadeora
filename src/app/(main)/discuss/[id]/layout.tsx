import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '실시간 토론방 | 카더라',
  description: '주식방, 부동산방, 자유방에서 실시간으로 토론하세요',
  robots: { index: true, follow: true },
};

export default function DiscussDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
