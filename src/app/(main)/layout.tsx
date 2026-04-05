import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Navigation } from '@/components/Navigation';
import AdBanner from '@/components/AdBanner';
import { ToastProvider } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Sidebar, RightPanel, InstallBanner, PWAInstallTracker, NoticeBanner, PageViewTracker, AutoPushPrompt, PromoSheet, GuestNudge, ExitIntentPopup, ScrollDepthGate, PopupAdManager, SignupNudge, ReturnVisitorBanner } from '@/components/ClientDynamics';
import TopLoadingBar from '@/components/TopLoadingBar';
import ScrollToTop from '@/components/ScrollToTop';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: { template: '%s | 카더라', default: '카더라 — 대한민국 소리소문 정보 커뮤니티' },
  description: '대한민국 소리소문 정보 커뮤니티 — 주식 시세, 아파트 청약, 실시간 토론을 하나의 앱에서',
  keywords: ['카더라', '소리소문', '커뮤니티', '주식', '부동산', '청약', '토론'],
  openGraph: { siteName: '카더라', type: 'website', locale: 'ko_KR' },
  robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, 'max-video-preview': -1 },
};

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const isLoggedIn = headerStore.get('x-user-logged-in') === '1';

  return (
    <ToastProvider>
      <AuthProvider serverLoggedIn={isLoggedIn}>
      <TopLoadingBar />
      <Navigation />
      <NoticeBanner />
      {/* TrendingTicker 제거됨 — 인기검색어는 Navigation 헤더에 통합 */}
      <AdBanner />
      <div style={{ display: 'flex', maxWidth: 1340, margin: '0 auto', gap: 24, padding: '0 clamp(12px, 3vw, 24px)', alignItems: 'flex-start' }}>
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <main id="main-content" style={{
          flex: 1, minWidth: 0,
          paddingTop: 'clamp(12px,3vw,20px)',
          paddingBottom: 72,
          minHeight: 'calc(100vh - 48px)',
          backgroundColor: 'var(--bg-base)',
          color: 'var(--text-primary)',
          overflowX: 'hidden',
        }}>
          <ErrorBoundary>
              {children}
          </ErrorBoundary>
        </main>
        <div className="right-panel-wrapper">
          <RightPanel />
        </div>
      </div>
      <InstallBanner />
      <PWAInstallTracker />
      <GuestNudge />
      <ExitIntentPopup />
      <ScrollDepthGate />
      <SignupNudge />
      <PromoSheet />
      <PopupAdManager />
      <ReturnVisitorBanner />
      <AutoPushPrompt />
      <PageViewTracker />
      <ScrollToTop />
      <footer className="hidden md:block" style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px 40px',
      }}>
        <div style={{borderTop:'1px solid var(--border)', paddingTop:16, fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', textAlign:'center', lineHeight:1.9}}>
          <p style={{fontWeight:600, color:'var(--text-secondary)', marginBottom:4}}>사업자 정보</p>
          <p>상호명: 카더라 &nbsp;|&nbsp; 대표자: 노영진 &nbsp;|&nbsp; 사업자등록번호: 278-57-00801</p>
          <p>사업장 주소: 부산광역시 연제구 연동로 27, 405호</p>
          <p>전화: 010-5001-1382 &nbsp;|&nbsp; 이메일: kadeora.app@gmail.com</p>
          <p style={{marginTop:4}}>© 2026 카더라. All rights reserved.</p>
        </div>
      </footer>
      </AuthProvider>
    </ToastProvider>
  );
}
