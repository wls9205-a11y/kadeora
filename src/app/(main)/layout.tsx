import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: { template: '%s | 카더라', default: '카더라' },
  description: '주식, 부동산, 청약, 자유게시판 — 카더라에서 소통하세요',
  keywords: ['카더라', '커뮤니티', '주식', '부동산', '청약', '토론'],
  openGraph: { siteName: '카더라', type: 'website', locale: 'ko_KR' },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Navigation />
      <main style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 'clamp(12px,3vw,20px) clamp(12px,3vw,24px) 90px',
        minHeight: 'calc(100vh - 48px)',
      }}>
        {children}
      </main>
    </ToastProvider>
  );
}