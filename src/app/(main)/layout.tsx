import type { Metadata } from 'next';
import { headers } from 'next/headers';
import ClientShell from './ClientShell';

export const metadata: Metadata = {
  title: { template: '%s | 카더라', default: '카더라 — 부동산·주식 정보 플랫폼' },
  description: '대한민국 소리소문 정보 커뮤니티 — 주식 시세, 아파트 청약, 실시간 토론을 하나의 앱에서',
  keywords: ['카더라', '소리소문', '커뮤니티', '주식', '부동산', '청약', '토론'],
  openGraph: { siteName: '카더라', type: 'website', locale: 'ko_KR' },
  robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, 'max-video-preview': -1 },
};

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const isLoggedIn = headerStore.get('x-user-logged-in') === '1';

  return (
    <ClientShell serverLoggedIn={isLoggedIn}>
      {children}
    </ClientShell>
  );
}
