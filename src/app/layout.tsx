import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/constants';
import './globals.css';
import './styles/components.css';
import './styles/blog.css';
import './styles/responsive.css';
import OfflineBanner from '@/components/OfflineBanner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { VercelAnalytics } from '@/components/common/Analytics';
import Script from 'next/script';
import KakaoInit from '@/components/KakaoInit';
import TossModeInit from '@/components/TossModeInit';
import TossBottomBanner from '@/components/TossBottomBanner';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '카더라 — 부동산·주식 정보 플랫폼 | kadeora.app',
    template: '%s | 카더라',
  },
  description: '카더라(kadeora.app) — 아파트 청약·재개발·실거래가, 주식 시세·AI 종목 분석, 투자 커뮤니티를 한곳에서. 7,600+ 데이터 분석 블로그.',
  keywords: ['카더라', 'kadeora', '카더라 부동산', '카더라 주식', '청약', '아파트 청약', '주식', '부동산', '청약 일정', '국내주식', '코스피', '코스닥', '실시간 시세', '재개발', 'AI 주식 분석', '커뮤니티'],
  authors: [{ name: '카더라', url: SITE_URL }],
  creator: '카더라',
  openGraph: {
    title: '카더라 — 부동산·주식 정보 플랫폼',
    description: '아파트 청약·재개발, 주식 시세·AI 종목 분석, 투자 커뮤니티를 한곳에서.',
    url: SITE_URL,
    siteName: '카더라',
    images: [
      { url: SITE_URL + '/api/og', width: 1200, height: 630, alt: '카더라 - 부동산·주식 정보 플랫폼' },
      { url: SITE_URL + '/api/og-square', width: 630, height: 630, alt: '카더라 - 부동산·주식 정보 플랫폼' },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '카더라 - 부동산·주식 정보 플랫폼',
    description: '아파트 청약·재개발, 주식 시세·AI 종목 분석, 투자 커뮤니티',
    images: [SITE_URL + '/api/og', SITE_URL + '/api/og-square'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  verification: {
    google: 'ozIZYKHPCsd47yk_paPH5mbsSNSCpc-hzLGgQw0lhyU',
    other: { 'naver-site-verification': '0d8703ac50ef51c3c2feb0ee48784069936492f5' },
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '카더라' },
  category: '금융, 부동산, 주식, 커뮤니티',
  alternates: { languages: { 'ko-KR': SITE_URL } },
  other: {
    'application-name': '카더라',
    'service-type': '금융·부동산 정보 커뮤니티',
    'service-region': '대한민국',
    'service-language': 'ko',
    'contact-email': 'kadeora.app@gmail.com',
    'naver:site_name': '카더라',
    'naver:author': '카더라',
    'daum:site_name': '카더라',
    'mobile-web-app-title': '카더라',
    'format-detection': 'telephone=no',
    'google': 'notranslate',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#050A18',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        {/* Preconnect — 주요 외부 도메인 DNS/TLS 선행 연결 (LCP 개선) */}
        <link rel="preconnect" href="https://tezftxakuwhsclarprlz.supabase.co" />
        <link rel="dns-prefetch" href="https://tezftxakuwhsclarprlz.supabase.co" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://dapi.kakao.com" />
        <link rel="alternate" type="application/rss+xml" title="카더라 블로그 RSS" href="/blog/feed" />
        <link rel="alternate" type="application/rss+xml" title="카더라 주식 RSS" href="/stock/feed" />
        <link rel="alternate" type="application/rss+xml" title="카더라 부동산 RSS" href="/apt/feed" />
        <link rel="search" type="application/opensearchdescription+xml" title="카더라 검색" href="/opensearch.xml" />
        <meta name="msvalidate.01" content="BAE0BF3F5071F16E8BAE497D195B2FD6" />
        <meta name="google-adsense-account" content="ca-pub-2356113563328542" />
        {/* iOS PWA 아이콘 — v6 캐시 갱신 */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=7" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png?v=7" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png?v=7" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.png?v=7" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/icon-128.png?v=7" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="카더라" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* 다크모드 강제 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('kd_theme');if(t==='light'){document.documentElement.classList.add('theme-light');document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}})();` }} />
        {/* 글씨크기 SSR 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `try{var fs=localStorage.getItem('kd_font_size');if(fs&&['small','medium','large'].indexOf(fs)>=0){var cl=document.documentElement.classList;cl.remove('font-small','font-medium','font-large');cl.add('font-'+fs);}}catch(e){}` }} />
        {/* Kakao SDK — KakaoInit 컴포넌트에서 next/script로 로드 (중복 방지) */}
        {/* JSON-LD 구조화 데이터 */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: '카더라',
          alternateName: ['KADEORA', 'kadeora.app', '카더라 부동산', '카더라 주식', '카더라 앱', '카더라 커뮤니티', '카더라 청약'],
          description: '부동산·주식 정보 플랫폼 — 아파트 청약·재개발, 주식 시세·AI 종목 분석, 투자 커뮤니티',
          url: SITE_URL,
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web, iOS, Android',
          inLanguage: 'ko-KR',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
          provider: {
            '@type': 'Organization',
            name: '카더라',
            url: SITE_URL,
            logo: {
              '@type': 'ImageObject',
              url: SITE_URL + '/icons/icon-192.png',
              width: 192,
              height: 192,
            },
            contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: 'kadeora.app@gmail.com', telephone: '+82-10-5001-1382', availableLanguage: '한국어' },
            address: { '@type': 'PostalAddress', addressCountry: 'KR', addressRegion: '부산광역시', addressLocality: '연제구', streetAddress: '연동로 27, 405호' },
          },
        }) }} />
        {/* WebSite schema — Google Sitelinks 검색 박스 */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: '카더라',
          alternateName: ['KADEORA', 'kadeora.app', '카더라 부동산', '카더라 주식'],
          url: SITE_URL,
          inLanguage: 'ko-KR',
          copyrightYear: new Date().getFullYear(),
          copyrightHolder: { '@type': 'Organization', name: '카더라', url: SITE_URL },
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        }) }} />
        {/* SiteNavigationElement — Google 확장 사이트링크 */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'SiteNavigationElement', name: '주식 시세', url: `${SITE_URL}/stock`, description: '실시간 주식 시세, 섹터 분석, AI 브리핑' },
            { '@type': 'SiteNavigationElement', name: '부동산', url: `${SITE_URL}/apt`, description: '아파트 청약, 분양, 미분양, 재개발 현황' },
            { '@type': 'SiteNavigationElement', name: '단지백과', url: `${SITE_URL}/apt/complex`, description: '전국 34,000+ 아파트 연차별 실거래가 비교' },
            { '@type': 'SiteNavigationElement', name: '블로그', url: `${SITE_URL}/blog`, description: '투자 정보 데이터 블로그' },
            { '@type': 'SiteNavigationElement', name: '종목 비교', url: `${SITE_URL}/stock/compare`, description: '국내외 주식 종목 핵심 지표 비교' },
            { '@type': 'SiteNavigationElement', name: '청약 가점 계산기', url: `${SITE_URL}/apt/diagnose`, description: '무주택·부양가족·통장 가점 자동 계산' },
            { '@type': 'SiteNavigationElement', name: '카더라 소개', url: `${SITE_URL}/about`, description: '카더라 — 부동산·주식 정보 플랫폼 소개' },
          ],
        }) }} />
        {/* Organization schema — 구글 Knowledge Panel + Entity 인식 */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: '카더라',
          alternateName: ['KADEORA', 'kadeora.app', '카더라 부동산', '카더라 주식', '카더라 앱'],
          url: SITE_URL,
          logo: { '@type': 'ImageObject', url: SITE_URL + '/icons/icon-512.png', width: 512, height: 512 },
          image: SITE_URL + '/icons/icon-512.png',
          description: '부동산·주식 정보 플랫폼 — 아파트 청약, 재개발, 주식 시세, AI 종목 분석, 투자 커뮤니티',
          foundingDate: '2026',
          founder: { '@type': 'Person', name: '노영진' },
          address: { '@type': 'PostalAddress', addressCountry: 'KR', addressRegion: '부산광역시', addressLocality: '연제구', streetAddress: '연동로 27, 405호', postalCode: '47571' },
          contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: 'kadeora.app@gmail.com', telephone: '+82-10-5001-1382', availableLanguage: 'Korean' },
          sameAs: [
            'https://blog.naver.com/silreit',
            'https://cafe.naver.com/kadeoraapp',
            'http://pf.kakao.com/_NFxdxhX',
          ],
          knowsAbout: ['부동산', '주식', '아파트 청약', '재개발', '미분양', 'AI 주식 분석', '실거래가', '분양', '재테크'],
          slogan: '아파트 청약·재개발, 주식 시세·AI 종목 분석을 한곳에서',
          numberOfEmployees: { '@type': 'QuantitativeValue', value: 1 },
          areaServed: { '@type': 'Country', name: '대한민국' },
        }) }} />
      </head>
      <body>
        <a href="#main-content" className="skip-to-content" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden', zIndex: 99999, padding: '12px 24px', background: 'var(--brand)', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>본문으로 건너뛰기</a>
        <style dangerouslySetInnerHTML={{ __html: `.skip-to-content:focus{position:fixed!important;left:16px!important;top:16px!important;width:auto!important;height:auto!important;overflow:visible!important}` }} />
        {/* 글로벌 PWA 설치 프롬프트 캡처 — 어디서든 window.__pwaPrompt 로 접근 */}
        <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;});` }} />
        <ThemeProvider>
        <TossModeInit />
        <TossBottomBanner />
        <OfflineBanner />
        <KakaoInit />
        {children}
        </ThemeProvider>
        {/* GA4 */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-VP4F6TH2GD" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-VP4F6TH2GD');gtag('config','AW-17792745509');`}</Script>
        <VercelAnalytics />
      </body>
    </html>
  );
}
