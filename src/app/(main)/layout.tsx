import type { Metadata } from 'next';
import ClientShell from './ClientShell';

export const metadata: Metadata = {
  title: { template: '%s | 카더라', default: '카더라 — 부동산·주식 정보 플랫폼' },
  description: '대한민국 소리소문 정보 커뮤니티 — 주식 시세, 아파트 청약, 실시간 토론을 하나의 앱에서',
  keywords: ['카더라', '소리소문', '커뮤니티', '주식', '부동산', '청약', '토론'],
  openGraph: { siteName: '카더라', type: 'website', locale: 'ko_KR' },
  robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, 'max-video-preview': -1 },
};

// s217 P0 Cache-Control: 기존 `await headers()` 가 (main) 전체를 dynamic 으로 강제 →
// Next.js 가 `Cache-Control: private, no-cache, no-store` 를 응답에 박아 middleware 의 public
// s-maxage=300 헤더가 무력화 됐음. AuthProvider 가 client-side `sb.auth.getSession()` 로 로그인
// 상태를 직접 감지하므로 serverLoggedIn 는 dead prop. 제거하여 ISR + edge cache 활성화.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientShell serverLoggedIn={false}>
      {children}
    </ClientShell>
  );
}
