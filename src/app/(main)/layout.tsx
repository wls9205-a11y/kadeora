import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { ToastProvider } from '@/components/Toast';
import { GuestGate } from '@/components/GuestGate';
import { createSupabaseServer } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: { template: '%s | 카더라', default: '카더라 — 대한민국 소리소문 정보 커뮤니티' },
  description: '대한민국 소리소문 정보 커뮤니티 — 주식 시세, 아파트 청약, 실시간 토론을 하나의 앱에서',
  keywords: ['카더라', '소리소문', '커뮤니티', '주식', '부동산', '청약', '토론'],
  openGraph: { siteName: '카더라', type: 'website', locale: 'ko_KR' },
};

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <ToastProvider>
      <Navigation />
      <main style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 'clamp(12px,3vw,20px) clamp(12px,3vw,24px) 90px',
        minHeight: 'calc(100vh - 48px)',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}>
        <GuestGate isLoggedIn={!!user}>
          {children}
        </GuestGate>
      </main>
    </ToastProvider>
  );
}
