'use client';
/**
 * (main)/ClientShell — s203 Nuclear isolation.
 *
 *  배경: production 에서 React #310 (Hook order) + #300 (Invalid element) 발생.
 *  (main)/layout.tsx 가 12+ client component 를 SSR 트리에 직접 마운트하는 동안
 *  Next.js 15 + React 19 + dynamic import 조합에서 SSR/hydrate hook 트리 mismatch
 *  edge case 발생.
 *
 *  Fix: layout 을 서버 component 로 단순화하고, hook-heavy + 공통 chrome 을
 *  본 ClientShell 로 이동. AuthProvider / ToastProvider / Navigation / Sidebar /
 *  RightPanel / Tracker 류 등 SSR 에 의미 없는 컴포넌트 모두 { ssr: false } 로
 *  격리 → SSR HTML 에는 children (페이지 본문) 만 직렬화 → SEO 영향 없음, hydrate
 *  단계에서 chrome 채워짐.
 *
 *  주의: { ssr: false } 컴포넌트는 SSR 시 placeholder 만 렌더되어 BAILOUT 신호를
 *  만들지만, blog/[slug] notFound() 는 페이지 자체에서 throw 하는 경로 (s187 후속
 *  fix) 이므로 본 변경 영향 없음.
 */

import dynamic from 'next/dynamic';
import { CONTACT_EMAIL, CONTACT_PHONE, BIZ_INFO_LINE, BIZ_ADDRESS_LINE, BIZ_CONTACT_LINE } from '@/lib/constants';
import ErrorBoundary from '@/components/ErrorBoundary';
import TopLoadingBar from '@/components/TopLoadingBar';
import ScrollToTop from '@/components/ScrollToTop';

const ToastProvider          = dynamic(() => import('@/components/Toast').then(m => m.ToastProvider),       { ssr: false });
const AuthProvider           = dynamic(() => import('@/components/AuthProvider').then(m => m.AuthProvider), { ssr: false });
const Navigation             = dynamic(() => import('@/components/Navigation').then(m => m.Navigation),     { ssr: false });
const NoticeBanner           = dynamic(() => import('@/components/NoticeBanner'),                            { ssr: false });
const AdBanner               = dynamic(() => import('@/components/AdBanner'),                                { ssr: false });
const Sidebar                = dynamic(() => import('@/components/Sidebar'),                                 { ssr: false });
const RightPanel             = dynamic(() => import('@/components/RightPanel'),                              { ssr: false });
const LiveBarChrome          = dynamic(() => import('@/components/ui/LiveBarChrome'),                        { ssr: false });
const ProfileCompleteBanner  = dynamic(() => import('@/components/ProfileCompleteBanner'),                   { ssr: false });
const GlobalMissionBar       = dynamic(() => import('@/components/GlobalMissionBar'),                        { ssr: false });
const StickySignupBar        = dynamic(() => import('@/components/StickySignupBar'),                         { ssr: false });
const InstallBanner          = dynamic(() => import('@/components/InstallBanner'),                           { ssr: false });
const PWAInstallTracker      = dynamic(() => import('@/components/PWAInstallTracker'),                       { ssr: false });
const PageViewTracker        = dynamic(() => import('@/components/PageViewTracker'),                         { ssr: false });
const BehaviorTracker        = dynamic(() => import('@/components/BehaviorTracker'),                         { ssr: false });
const CtaGlobalTracker       = dynamic(() => import('@/components/CtaGlobalTracker'),                        { ssr: false });
const WelcomeReward          = dynamic(() => import('@/components/WelcomeReward'),                           { ssr: false });
const WelcomeToast           = dynamic(() => import('@/components/WelcomeToast'),                            { ssr: false });
const SmartPushPrompt        = dynamic(() => import('@/components/SmartPushPrompt'),                         { ssr: false });
const KakaoChannelAddModal   = dynamic(() => import('@/components/signup/KakaoChannelAddModal'),             { ssr: false });
const VitalsReporter         = dynamic(() => import('@/components/web-vitals/VitalsReporter'),               { ssr: false });

interface Props {
  children: React.ReactNode;
  serverLoggedIn: boolean;
}

export default function ClientShell({ children, serverLoggedIn }: Props) {
  return (
    <ToastProvider>
      <AuthProvider serverLoggedIn={serverLoggedIn}>
        <TopLoadingBar />
        <VitalsReporter />
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
              <LiveBarChrome />
              {children}
            </ErrorBoundary>
          </main>
          <div className="right-panel-wrapper">
            <RightPanel />
          </div>
        </div>
        <InstallBanner />
        <PWAInstallTracker />
        <StickySignupBar />

        <PageViewTracker />
        <BehaviorTracker />
        <CtaGlobalTracker />
        <WelcomeReward />
        <KakaoChannelAddModal triggerOnMount={true} />
        <WelcomeToast />
        <ScrollToTop />
        <SmartPushPrompt />
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

// CONTACT_EMAIL/PHONE 는 footer 에서 직접 사용 안 하지만 import 보존 (다른 의존 가능성).
void CONTACT_EMAIL;
void CONTACT_PHONE;
