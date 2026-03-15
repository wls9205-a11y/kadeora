import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: { template: '%s | KADEORA', default: 'KADEORA - 진짜 정보가 오가는 금융 커뮤니티' },
  description: '주식, 청약, 재테크 정보를 공유하는 프리미엄 금융 커뮤니티',
  keywords: ['주식', '청약', '재테크', '금융', '투자'],
  openGraph: {
    siteName: 'KADEORA',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Navigation />
      <main style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '20px 16px 90px',
        minHeight: 'calc(100vh - 60px)',
      }}>
        {children}
      </main>
    </ToastProvider>
  );
}
