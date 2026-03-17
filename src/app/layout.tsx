import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import OfflineBanner from '@/components/OfflineBanner';

const inter = Inter({ subsets: ['latin'] });

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
    images: [{ url: 'https://kadeora.app/og-image.svg', width: 1200, height: 628, alt: '카더라 — 소리소문 정보 커뮤니티' }],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '카더라 — 아는 사람만 아는 그 정보',
    description: '주식 시세, 아파트 청약, 우리동네 소식을 가장 빠르게.',
    images: ['https://kadeora.app/og-image.svg'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '카더라' },
  category: '금융, 부동산, 커뮤니티',
  alternates: { canonical: 'https://kadeora.app', languages: { 'ko-KR': 'https://kadeora.app' } },
  other: {
    'application-name': '카더라',
    'service-type': '금융·부동산 정보 커뮤니티',
    'service-region': '대한민국',
    'service-language': 'ko',
    'contact-email': 'wls9205@gmail.com',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ff5b36' },
    { media: '(prefers-color-scheme: dark)',  color: '#0d1117' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        {/* 다크모드 강제 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){document.documentElement.classList.add('dark');})();` }} />
        {/* 글씨크기 SSR 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `try{var fs=localStorage.getItem('kd_font_size');var sizes={small:'13px',medium:'15px',large:'17px'};if(fs&&sizes[fs])document.documentElement.style.setProperty('--font-base',sizes[fs]);}catch(e){}` }} />
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
            contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: 'wls9205@gmail.com', availableLanguage: '한국어' },
          },
        }) }} />
      </head>
      <body className={inter.className}><OfflineBanner />{children}</body>
    </html>
  );
}
