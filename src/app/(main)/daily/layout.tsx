import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: '카더라 데일리 리포트',
  description: '매일 업데이트되는 지역별 부동산·주식 시장 리포트',
  robots: { index: false, follow: true },
};

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
