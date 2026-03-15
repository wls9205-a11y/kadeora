import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'KADEORA - 진짜 정보가 오가는 금융 커뮤니티',
  description: '주식, 청약, 재테크 정보를 공유하는 프리미엄 금융 커뮤니티',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kadeora.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
