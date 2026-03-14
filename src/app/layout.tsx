import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@/styles/globals.css";
import { ConsentBanner } from "@/components/common/ConsentBanner";
import { VercelAnalytics } from "@/components/common/Analytics";

/**
 * Final A-grade root layout:
 * - Kim Zetter: nonce-based script loading
 * - Osmani: font preload + Vercel Analytics
 * - Kent: a11y skip-to-content link
 * - Fishkin: Schema.org structured data
 */

export const metadata: Metadata = {
  metadataBase: new URL("https://kadeora.vercel.app"),
  title: { default: "카더라 KADEORA — 주식·부동산·청약 금융 커뮤니티", template: "%s | 카더라 KADEORA" },
  description: "주식, 부동산, 청약 정보를 실시간으로 나누는 금융 특화 커뮤니티.",
  keywords: ["카더라", "KADEORA", "주식 커뮤니티", "부동산 커뮤니티", "청약 정보", "실시간 주식 토론"],
  openGraph: {
    type: "website", locale: "ko_KR", url: "https://kadeora.vercel.app", siteName: "카더라 KADEORA",
    title: "카더라 — 진짜 정보가 오가는 금융 커뮤니티",
    description: "주식·부동산·청약 실시간 커뮤니티.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "카더라 KADEORA" }],
  },
  twitter: { card: "summary_large_image", title: "카더라 KADEORA", images: ["/og-image.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
};

export const viewport: Viewport = {
  themeColor: "#0A0E17", width: "device-width", initialScale: 1, maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") || "";

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Osmani: font preconnect + preload for FOIT prevention */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/woff2/PretendardVariable.woff2"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script nonce={nonce} src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" async />
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "카더라 KADEORA",
              url: "https://kadeora.vercel.app",
              description: "주식·부동산·청약 금융 특화 커뮤니티",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://kadeora.vercel.app/search?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body>
        {/* Kent: a11y skip-to-content link */}
        <a
          href="#main-content"
          style={{
            position: "absolute", left: -9999, top: "auto", width: 1, height: 1, overflow: "hidden",
          }}
          onFocus={(e) => { (e.target as HTMLElement).style.cssText = "position:fixed;top:8px;left:8px;z-index:99999;padding:12px 24px;background:#3B82F6;color:#FFF;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;width:auto;height:auto;overflow:visible;"; }}
          onBlur={(e) => { (e.target as HTMLElement).style.cssText = "position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;"; }}
        >
          본문으로 건너뛰기
        </a>

        <div id="main-content">
          {children}
        </div>

        <ConsentBanner />
        {/* Osmani: Vercel Analytics + Speed Insights */}
        <VercelAnalytics />
      </body>
    </html>
  );
}
