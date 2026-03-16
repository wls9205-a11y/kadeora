import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '카더라 - 대한민국 No.1 커뮤니티 플랫폼',
  description: '주식, 부동산, 청약, 자유게시판 — 카더라에서 소통하세요',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kadeora.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
        {/* 테마 깜빡임 방지 — JS 최우선 실행 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try{
    var s=localStorage.getItem('kd-theme');
    var t=s==='dark'||s==='light'?s:window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
    document.documentElement.setAttribute('data-theme',t);
  }catch(e){}
})();
            `.trim()
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}