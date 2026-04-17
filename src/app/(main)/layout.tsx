import { CONTACT_EMAIL, CONTACT_PHONE, BIZ_INFO_LINE, BIZ_ADDRESS_LINE, BIZ_CONTACT_LINE } from '@/lib/constants';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Navigation } from '@/components/Navigation';
import AdBanner from '@/components/AdBanner';
import { ToastProvider } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import ActionBar from '@/components/ActionBar';


import { Sidebar, RightPanel, InstallBanner, PWAInstallTracker, NoticeBanner, PageViewTracker, BehaviorTracker } from '@/components/ClientDynamics';
import TopLoadingBar from '@/components/TopLoadingBar';
import ScrollToTop from '@/components/ScrollToTop';
import { AuthProvider } from '@/components/AuthProvider';
import WelcomeReward from '@/components/WelcomeReward';
import WelcomeToast from '@/components/WelcomeToast';
import GlobalMissionBar from '@/components/GlobalMissionBar';
import SmartPushPrompt from '@/components/SmartPushPrompt';
import ProfileCompleteBanner from '@/components/ProfileCompleteBanner';
import SignupNudgeModal from '@/components/SignupNudgeModal';

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
    <ToastProvider>
      <AuthProvider serverLoggedIn={isLoggedIn}>
      <TopLoadingBar />
      <Navigation />
      <NoticeBanner />
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

              <ProfileCompleteBanner />
              <GlobalMissionBar />
              {children}
          </ErrorBoundary>
        </main>
        <div className="right-panel-wrapper">
          <RightPanel />
        </div>
      </div>
      <InstallBanner />
      <PWAInstallTracker />
      <ActionBar />

      <PageViewTracker />
      <BehaviorTracker />
      <WelcomeReward />
      <WelcomeToast />
      <ScrollToTop />
      <SmartPushPrompt />
      <SignupNudgeModal />
      <footer className="hidden md:block" style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px 40px',
      }}>
        <div style={{borderTop:'1px solid var(--border)', paddingTop:16, fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', textAlign:'center', lineHeight:1.9}}>
          <nav style={{display:'flex', justifyContent:'center', gap:16, flexWrap:'wrap', marginBottom:12, fontSize:11}}>
            <a href="/stock" style={{color:'var(--text-secondary)',textDecoration:'none'}}>주식</a>
            <a href="/stock/dividend" style={{color:'var(--text-secondary)',textDecoration:'none'}}>배당주</a>
            <a href="/stock/themes" style={{color:'var(--text-secondary)',textDecoration:'none'}}>테마주</a>
            <a href="/apt" style={{color:'var(--text-secondary)',textDecoration:'none'}}>부동산</a>
            <a href="/apt/complex" style={{color:'var(--text-secondary)',textDecoration:'none'}}>단지백과</a>
            <a href="/apt/redev" style={{color:'var(--text-secondary)',textDecoration:'none'}}>재개발</a>
            <a href="/blog" style={{color:'var(--text-secondary)',textDecoration:'none'}}>블로그</a>
            <a href="/calc" style={{color:'var(--text-secondary)',textDecoration:'none'}}>계산기</a>
            <a href="/daily/전국" style={{color:'var(--text-secondary)',textDecoration:'none'}}>데일리</a>
            <a href="/hot" style={{color:'var(--text-secondary)',textDecoration:'none'}}>인기글</a>
            <a href="/feed" style={{color:'var(--text-secondary)',textDecoration:'none'}}>커뮤니티</a>
            <a href="/discuss" style={{color:'var(--text-secondary)',textDecoration:'none'}}>토론</a>
            <a href="/premium" style={{color:'var(--text-secondary)',textDecoration:'none'}}>프리미엄</a>
            <a href="/press" style={{color:'var(--text-secondary)',textDecoration:'none'}}>보도자료</a>
            <a href="/about" style={{color:'var(--text-secondary)',textDecoration:'none'}}>소개</a>
          </nav>
          <p style={{fontWeight:600, color:'var(--text-secondary)', marginBottom:4}}>사업자 정보</p>
          <p>{BIZ_INFO_LINE}</p>
          <p>{BIZ_ADDRESS_LINE}</p>
          <p>{BIZ_CONTACT_LINE}</p>
          <p style={{marginTop:4}}>© 2026 <a href="/about" style={{color:'var(--text-secondary)',textDecoration:'none',fontWeight:600}}>카더라</a>. All rights reserved.</p>
        </div>
      </footer>
      </AuthProvider>
    </ToastProvider>
  );
}
