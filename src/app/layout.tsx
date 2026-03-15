import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '카더라 - 대한민국 No.1 커뮤니티 플랫폼',
  description: '주식, 부동산, 청약, 자유게시판 — 카더라에서 소통하세요',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kadeora.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}