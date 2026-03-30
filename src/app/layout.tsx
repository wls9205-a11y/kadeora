import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/constants';
import { Inter } from 'next/font/google';
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

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: true });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '카더라 — 대한민국 소리소문 정보 커뮤니티',
    template: '%s | 카더라',
  },
  description: '아는 사람만 아는 그 정보 — 주식 시세, 아파트 청약, 우리동네 소식을 가장 빠르게',
  keywords: ['청약', '아파트 청약', '주식', '부동산', '카더라', '청약 일정', '국내주식', '코스피', '코스닥', '실시간 시세', '소문', '커뮤니티'],
  authors: [{ name: '카더라', url: SITE_URL }],
  creator: '카더라',
  openGraph: {
    title: '카더라 — 아는 사람만 아는 그 정보',
    description: '주식 시세, 아파트 청약, 우리동네 소식을 가장 빠르게. 소리소문 정보 커뮤니티.',
    url: SITE_URL,
    siteName: '카더라',
    images: [
      { url: SITE_URL + '/api/og', width: 1200, height: 630, alt: '카더라 - 대한민국 소리소문 정보 커뮤니티' },
      { url: SITE_URL + '/api/og-square', width: 630, height: 630, alt: '카더라 - 대한민국 소리소문 정보 커뮤니티' },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '카더라 - 대한민국 소리소문 정보 커뮤니티',
    description: '부동산 · 주식 · 청약 · 지역 소식',
    images: [SITE_URL + '/api/og', SITE_URL + '/api/og-square'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  verification: {
    google: 'ozIZYKHPCsd47yk_paPH5mbsSNSCpc-hzLGgQw0lhyU',
    other: { 'naver-site-verification': '0d8703ac50ef51c3c2feb0ee48784069936492f5' },
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '카더라' },
  category: '금융, 부동산, 커뮤니티',
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
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050A18',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        {/* Preconnect — 주요 외부 도메인 DNS/TLS 선행 연결 (LCP 개선) */}
        <link rel="preconnect" href="https://tezftxakuwhsclarprlz.supabase.co" />
        <link rel="dns-prefetch" href="https://tezftxakuwhsclarprlz.supabase.co" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://dapi.kakao.com" />
        <link rel="alternate" type="application/rss+xml" title="카더라 RSS" href="/feed.xml" />
        <link rel="alternate" type="application/rss+xml" title="카더라 주식 RSS" href="/feed.xml?category=stock" />
        <link rel="alternate" type="application/rss+xml" title="카더라 부동산 RSS" href="/feed.xml?category=apt" />
        <link rel="alternate" type="application/rss+xml" title="카더라 재테크 RSS" href="/feed.xml?category=finance" />
        <link rel="alternate" type="application/rss+xml" title="카더라 블로그" href="/blog/feed" />
        <link rel="alternate" type="application/rss+xml" title="카더라 주식 종목 RSS" href="/stock/feed" />
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
        <meta name="geo.region" content="KR" />
        <meta name="geo.placename" content="대한민국" />
        <meta name="geo.position" content="37.5665;126.9780" />
        <meta name="ICBM" content="37.5665, 126.9780" />
        {/* 다크모드 강제 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){document.documentElement.classList.add('dark');})();` }} />
        {/* 글씨크기 SSR 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `try{var fs=localStorage.getItem('kd_font_size');if(fs&&['small','medium','large'].indexOf(fs)>=0){var cl=document.documentElement.classList;cl.remove('font-small','font-medium','font-large');cl.add('font-'+fs);}}catch(e){}` }} />
        {/* Kakao SDK — KakaoInit 컴포넌트에서 next/script로 로드 (중복 방지) */}
        {/* JSON-LD 구조화 데이터 */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: '카더라',
          alternateName: ['KADEORA', '카더라 커뮤니티'],
          description: '대한민국 소리소문 정보 커뮤니티 — 주식 시세, 아파트 청약, 실시간 토론',
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
          alternateName: 'KADEORA',
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
      </head>
      <body className={inter.className}>
        {/* 글로벌 PWA 설치 프롬프트 캡처 — 어디서든 window.__pwaPrompt 로 접근 */}
        <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;});` }} />
        <ThemeProvider>
        <TossModeInit />
        <OfflineBanner />
        <KakaoInit />
        {children}
        </ThemeProvider>
        {/* GA4 */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-VP4F6TH2GD" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-VP4F6TH2GD');`}</Script>
        <VercelAnalytics />
      </body>
    </html>
  );
}
