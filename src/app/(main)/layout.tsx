import ThemeToggle from '@/components/ThemeToggle';
import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: { template: '%s | KADEORA', default: 'KADEORA - 吏꾩쭨 ?뺣낫媛 ?ㅺ???湲덉쑖 而ㅻ??덊떚' },
  description: '二쇱떇, 泥?빟, ?ы뀒???뺣낫瑜?怨듭쑀?섎뒗 ?꾨━誘몄뾼 湲덉쑖 而ㅻ??덊떚',
  keywords: ['二쇱떇', '泥?빟', '?ы뀒??, '湲덉쑖', '?ъ옄'],
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
      <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50 }}><ThemeToggle /></div>
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