import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import TrendingTicker from '@/components/TrendingTicker';
import { ToastProvider } from '@/components/Toast';
import { GuestGate } from '@/components/GuestGate';
import ErrorBoundary from '@/components/ErrorBoundary';
import FeedbackButton from '@/components/FeedbackButton';
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
      <TrendingTicker />
      <main style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 'clamp(12px,3vw,20px) clamp(12px,3vw,24px) 90px',
        minHeight: 'calc(100vh - 48px)',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}>
        <ErrorBoundary>
          <GuestGate isLoggedIn={!!user}>
            {children}
          </GuestGate>
        </ErrorBoundary>
        <FeedbackButton />
      </main>
      <footer className="hidden md:block" style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px 40px',
      }}>
        <div style={{borderTop:'1px solid var(--border)', paddingTop:16, fontSize:11, color:'var(--text-tertiary)', textAlign:'center', lineHeight:1.9}}>
          <p style={{fontWeight:600, color:'var(--text-secondary)', marginBottom:4}}>사업자 정보</p>
          <p>업체명: 카더라 &nbsp;|&nbsp; 사업자등록번호: 278-57-00801 &nbsp;|&nbsp; 대표자: 노영진</p>
          <p>이메일: kadeora.app@gmail.com &nbsp;|&nbsp; 통신판매업 신고번호: 준비중</p>
          <p style={{marginTop:4}}>© 2026 카더라. All rights reserved.</p>
        </div>
      </footer>
    </ToastProvider>
  );
}
