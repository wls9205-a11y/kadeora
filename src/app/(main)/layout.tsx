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
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 16,
          fontSize: 11,
          color: 'var(--text-tertiary)',
          lineHeight: 1.8,
        }}>
          <p style={{fontWeight:600, marginBottom:4}}>카더라 사업자 정보</p>
          <p>상호: 카더라 | 대표자: 노영진 | 사업자등록번호: 278-57-00801</p>
          <p>주소: 부산광역시 연제구 연동로 27, B동 405호(연산동, 삼성맨션)</p>
          <p>통신판매업 신고번호: 신고 준비중 | 이메일: kadeora.app@gmail.com</p>
          <p>전화: 051-860-2224 | 호스팅 서비스: Vercel Inc.</p>
          <p style={{marginTop:4}}>© 2026 카더라. All rights reserved.</p>
        </div>
      </footer>
    </ToastProvider>
  );
}
