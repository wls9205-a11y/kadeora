import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { ConsentBanner } from "@/components/common/ConsentBanner";
import { VercelAnalytics } from "@/components/common/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://kadeora.vercel.app"),
  title: { default: "카더라 KADEORA — 주식·부동산·청약 금융 커뮤니티", template: "%s | 카더라 KADEORA" },
  description: "주식, 부동산, 청약 정보를 실시간으로 나누는 금융 특화 커뮤니티.",
  openGraph: {
    type: "website", locale: "ko_KR", url: "https://kadeora.vercel.app", siteName: "카더라 KADEORA",
    title: "카더라 — 진짜 정보가 오가는 금융 커뮤니티",
    description: "주식·부동산·청약 실시간 커뮤니티.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "카더라 KADEORA" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A0E17", width: "device-width", initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>
        <div id="main-content">{children}</div>
        <ConsentBanner />
        <VercelAnalytics />
      </body>
    </html>
  );
}
