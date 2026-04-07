import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  generateBuildId: () => `build-${process.env.NEXT_PUBLIC_CACHE_VERSION || '20260329'}`,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse'],

  // Edge Runtime에서 /api/og, /api/og-square가 public/fonts/** 접근할 수 있도록 번들에 포함
  outputFileTracingIncludes: {
    '/api/og':        ['./public/fonts/**'],
    '/api/og-square': ['./public/fonts/**'],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tezftxakuwhsclarprlz.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "kadeora.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
      { protocol: "http", hostname: "k.kakaocdn.net" },
      { protocol: "https", hostname: "*.kakaocdn.net" },
      { protocol: "http", hostname: "*.kakaocdn.net" },
      { protocol: "https", hostname: "img1.kakaocdn.net" },
      { protocol: "https", hostname: "t1.kakaocdn.net" },
      { protocol: "https", hostname: "kadeora.app" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },

  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'lucide-react', 'marked'],
  },

  env: {
    NEXT_PUBLIC_KAKAO_JS_KEY: process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '',
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'https://kadeora.app',
  },

  async headers() {
    return [
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/favicon.:ext*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800" },
        ],
      },
      {
        source: "/api/og",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=604800" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/api/og-square",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=604800" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          // CSP는 middleware.ts에서 관리 (여기서 설정하면 충돌)
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/api/stock-debug", destination: "/", permanent: true },
      { source: "/api/stock-debug/:path*", destination: "/", permanent: true },
      { source: "/rss", destination: "/feed.xml", permanent: true },
      { source: "/rss.xml", destination: "/feed.xml", permanent: true },
      { source: "/sitemap", destination: "/sitemap.xml", permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "kadeora",
  project: process.env.SENTRY_PROJECT || "kadeora",
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
