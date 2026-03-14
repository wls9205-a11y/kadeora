import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/lib/theme'
import { AuthProvider, QueryProvider } from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: '카더라 - 동네 소문의 중심',
  description: '주식/부동산에 관심 있는 위치 기반 소리소문 커뮤니티',
  keywords: ['카더라', '주식', '부동산', '커뮤니티', '청약', '투자'],
  authors: [{ name: 'KADEORA' }],
  openGraph: {
    title: '카더라 - 동네 소문의 중심',
    description: '주식/부동산에 관심 있는 위치 기반 소리소문 커뮤니티',
    url: 'https://kadeora.vercel.app',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '카더라 - 동네 소문의 중심',
    description: '주식/부동산에 관심 있는 위치 기반 소리소문 커뮤니티',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0A0A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <body>
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
