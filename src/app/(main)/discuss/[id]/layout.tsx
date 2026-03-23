import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '토론방',
  description: '실시간 토론에 참여하세요. 주식·부동산·경제 이슈를 함께 이야기합니다.',
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
