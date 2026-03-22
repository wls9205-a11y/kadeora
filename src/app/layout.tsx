import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import OfflineBanner from '@/components/OfflineBanner';
import { ThemeProvider } from '@/components/ThemeProvider';
import CookieBanner from '@/components/CookieBanner';
import Script from 'next/script';
import KakaoInit from '@/components/KakaoInit';

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: true });

export const metadata: Metadata = {
  metadataBase: new URL('https://kadeora.app'),
  title: {
    default: '카더라 — 대한민국 소리소문 정보 커뮤니티',
    template: '%s | 카더라',
  },
  description: '아는 사람만 아는 그 정보 — 주식 시세, 아파트 청약, 우리동네 소식을 가장 빠르게',
  keywords: ['청약', '아파트 청약', '주식', '부동산', '카더라', '청약 일정', '국내주식', '코스피', '코스닥', '실시간 시세', '소문', '커뮤니티'],
  authors: [{ name: '카더라', url: 'https://kadeora.app' }],
  creator: '카더라',
  openGraph: {
    title: '카더라 — 아는 사람만 아는 그 정보',
    description: '주식 시세, 아파트 청약, 우리동네 소식을 가장 빠르게. 소리소문 정보 커뮤니티.',
    url: 'https://kadeora.app',
    siteName: '카더라',
    images: [{ url: 'https://kadeora.app/images/brand/kadeora-hero.png', width: 1024, height: 1024, alt: '카더라 - 대한민국 소리소문 정보 커뮤니티' }],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '카더라 - 대한민국 소리소문 정보 커뮤니티',
    description: '부동산 · 주식 · 청약 · 지역 소식',
    images: ['https://kadeora.app/images/brand/kadeora-wide.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  verification: {
    google: 'ozIZYKHPCsd47yk_paPH5mbsSNSCpc-hzLGgQw0lhyU',
    other: { 'naver-site-verification': '0d8703ac50ef51c3c2feb0ee48784069936492f5' },
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '카더라' },
  category: '금융, 부동산, 커뮤니티',
  alternates: { languages: { 'ko-KR': 'https://kadeora.app' } },
  other: {
    'application-name': '카더라',
    'service-type': '금융·부동산 정보 커뮤니티',
    'service-region': '대한민국',
    'service-language': 'ko',
    'contact-email': 'kadeora.app@gmail.com',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0F1D35' },
    { media: '(prefers-color-scheme: dark)',  color: '#0B1426' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png?v=2" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png?v=2" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.png?v=2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
          url: 'https://kadeora.app',
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web, iOS, Android',
          inLanguage: 'ko-KR',
          provider: {
            '@type': 'Organization',
            name: '카더라',
            url: 'https://kadeora.app',
            logo: {
              '@type': 'ImageObject',
              url: 'https://kadeora.app/images/brand/kadeora-hero.png',
            },
            contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: 'kadeora.app@gmail.com', availableLanguage: '한국어' },
          },
        }) }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
        <OfflineBanner />
        <KakaoInit />
        {children}
        <CookieBanner />
        </ThemeProvider>
        {/* GA4 */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-VP4F6TH2GD" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-VP4F6TH2GD');`}</Script>
      </body>
    </html>
  );
}
