import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { ToastProvider } from '@/components/Toast';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: { template: '%s | KADEORA', default: 'KADEORA' },
  description: 'Financial community platform',
  keywords: ['stock', 'apt', 'community', 'finance'],
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
