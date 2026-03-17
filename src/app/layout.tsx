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
  description: '대한민국 소리소문 정보 커뮤니티 — 주식 시세, 아파트 청약, 실시간 토론을 하나의 앱에서',
  keywords: ['카더라','소리소문','금융 커뮤니티','주식 커뮤니티','아파트 청약','부동산 커뮤니티','KOSPI','KOSDAQ'],
  authors: [{ name: '카더라', url: 'https://kadeora.app' }],
  creator: '카더라',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://kadeora.app',
    siteName: '카더라',
    title: '카더라 — 대한민국 소리소문 정보 커뮤니티',
    description: '대한민국 소리소문 정보 커뮤니티 — 주식 시세, 아파트 청약, 실시간 토론',
    images: [{ url: 'https://kadeora.app/api/og', width: 1200, height: 630, alt: '카더라' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '카더라 — 대한민국 소리소문 정보 커뮤니티',
    description: '대한민국 소리소문 정보 커뮤니티',
    images: ['https://kadeora.app/api/og'],
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
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 다크모드 플리커 방지 — hydration 전에 즉시 실행 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){
  try{
    var s=localStorage.getItem('kadeora-theme');
    var d=window.matchMedia('(prefers-color-scheme:dark)').matches;
    var t=s||(d?'dark':'light');
    if(t==='dark'){document.documentElement.classList.add('dark');}
    else{document.documentElement.classList.remove('dark');}
  }catch(e){}
})();` }} />
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
