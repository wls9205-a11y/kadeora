import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // s204: production source maps — React #310/#300 정확한 file:line stack trace 확보용
  productionBrowserSourceMaps: true,
  generateBuildId: async () =>
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
      ?? process.env.NEXT_PUBLIC_CACHE_VERSION
      ?? `build-${Date.now().toString(36)}`,
  // TODO Phase 1.5: 17 파일 + stale type chain 정리 후 false 복원
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse'],

  // s280: streaming metadata 비활성화 — /stock, /blog, /discuss/[id], /feed 등 generateMetadata가
  // DB 조회로 느려지는 페이지에서 title/OG/canonical/robots가 실제 <head> 밖(body 스트리밍 영역)에
  // 렌더링되어 카카오톡/네이버 등 JS 미실행 크롤러에 노출 안 되는 문제 확인.
  // Vercel 엣지 캐시가 User-Agent별로 분리되지 않아 Next 기본 htmlLimitedBots(Googlebot 등)도
  // 무력화됨 — 전체 UA에 대해 항상 blocking metadata를 강제해 근본 차단.
  htmlLimitedBots: /.*/,

  // s263 Phase 2.1: og-stock / og-blog 회귀 — public/fonts trace 누락 시 satori 가
  // dynamic font fetch 시도 → "Failed to load dynamic font" → 매 분 5건 burst → 302 redirect.
  // 모든 og-* 라우트에 폰트 trace 명시.
  outputFileTracingIncludes: {
    '/api/og':        ['./public/fonts/**'],
    '/api/og-square': ['./public/fonts/**'],
    '/api/og-stock':  ['./public/fonts/**'],
    '/api/og-blog':   ['./public/fonts/**'],
    '/api/og-apt':    ['./public/fonts/**'],
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
      // 블로그 커버/히어로 외부 이미지 최적화
      { protocol: "https", hostname: "imgnews.naver.net" },
      { protocol: "https", hostname: "*.pstatic.net" },
      { protocol: "https", hostname: "shop1.phinf.naver.net" },
      { protocol: "https", hostname: "t1.daumcdn.net" },
      { protocol: "https", hostname: "img1.daumcdn.net" },
      { protocol: "https", hostname: "i2.media.daumcdn.net" },
      { protocol: "https", hostname: "blog.kakaocdn.net" },
      // s230-s231: apt cover image 외부 호스트
      { protocol: "https", hostname: "postfiles.pstatic.net" },
      { protocol: "https", hostname: "ldb-phinf.pstatic.net" },
      { protocol: "https", hostname: "scs-phinf.pstatic.net" },
      { protocol: "https", hostname: "dthumb-phinf.pstatic.net" },
      { protocol: "https", hostname: "landthumb-phinf.pstatic.net" },
      { protocol: "https", hostname: "mblogthumb-phinf.pstatic.net" },
      { protocol: "https", hostname: "d2v80xjmx68n4w.cloudfront.net" },
      { protocol: "https", hostname: "cdn.bizwatch.co.kr" },
      // 블로그 커버 이미지 추가 도메인 (세션 114 — 270개 깨짐 수정)
      { protocol: "https", hostname: "www.neonet.co.kr" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "www.lottecastle.co.kr" },
      { protocol: "https", hostname: "static.cdn.soomgo.com" },
      { protocol: "https", hostname: "*.muscache.com" },
      { protocol: "https", hostname: "*.bobaedream.co.kr" },
      { protocol: "https", hostname: "image.yes24.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "cdn.newspim.com" },
      { protocol: "https", hostname: "*.mk.co.kr" },
      { protocol: "https", hostname: "*.chosun.com" },
      { protocol: "https", hostname: "*.sedaily.com" },
      { protocol: "https", hostname: "*.hankyung.com" },
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
      /* ⛔ /feed 목록 «영구» 폐쇄 → /apt (Node 판정 2026-08-31)
       *
       * ⚠️ 이 자리는 A4(8/27)에 «임시 이전(302)» 으로 섰고, 그때 주석은
       *    「Phase B4 에서 관측 스트림으로 되살릴 예정」이라 적었다. 그 계획은 폐기됐다 —
       *    실사용자 UGC 가 2026-04-19 주부터 전 표면 0 이었고, 「살아 있어 보이던」
       *    커뮤니티는 시드가 만든 것이었다(b96c7ff6 실측). 되살릴 것이 없다.
       *    주석과 코드가 어긋나면 다음 사람이 «되살릴 계획이 있다» 고 읽는다. 같이 고친다.
       *
       * ⚠️ permanent: true «의도된 301» 이다. 302 였던 이유(되돌릴 계획)가 사라졌고,
       *    검색엔진이 /feed 를 /apt 로 통합하는 것이 이제 «원하는» 결과다.
       * ⚠️ 하위 경로(/feed/:id)는 «여전히 건드리지 않는다». 색인 300건이 실사용자 글이고
       *    네이버 유입 76/월을 만든다(2026-08-31 실측) — 읽기 전용 아카이브로 유지한다.
       *    폐쇄는 표면을 접는 일이지 자산을 태우는 일이 아니다.
       *    시드 글은 상세 페이지에서 notFound() 로 닫았다(데이터 무변경).
       * ⚠️ /feed.xml 은 다른 것이다 — source 를 정확히 "/feed" 로 한정한다. */
      { source: "/feed", destination: "/apt", permanent: true },

      /* ⛔ 구표면 «영구» 폐쇄 (Node 판정 2026-09-07 — 「폐쇄」·「내림」)
       *
       * AD-4(9/7 오전)가 noindex + 진입 링크 회수까지 «가역» 으로 해 뒀고, 이제 라우트를 접는다.
       * 폐쇄 사유는 각 표면마다 다르다:
       *   /hot            — 합성 view_count·likes 정렬의 「인기 게시글」. 영구 폐쇄된 피드의 부속.
       *   /shop·megaphone — 사망한 피드에 글을 띄우는 확성기를 팔고 있었다(구매 성립 시 사고).
       *   /grades         — 커뮤니티 시대 게이미피케이션.
       *   /premium        — 「내림」. 유지하려면 전자상거래 표기(상호·사업자번호·통신판매업신고)가
       *                     선행 의무인데 현재 0건이다. 판매 표면을 접는 쪽을 골랐다.
       *
       * ⚠️ /hot 만 /apt 로 보낸다 — 그 표면의 독자는 「단지 소식을 보러 온 사람」에 가깝다.
       *    나머지는 대체할 화면이 없어서 홈으로 보낸다. 없는 곳으로 보내느니 홈이 정직하다.
       * ⚠️ permanent: true «의도된 301» 이다. 되살릴 계획이 없으므로 검색엔진이 통합하는 것이
       *    원하는 결과다. 되살리기로 하면 이 항목을 지우고 라우트를 복원하면 된다(git revert).
       * ⛔ 하위 경로는 열지 않는다 — source 를 정확한 경로로 «한정» 한다.
       *    /shop/megaphone 을 따로 적은 것이 그 이유다(:path* 를 쓰지 않는다).
       * ⛔ feed·discuss·points·등급 «데이터» 는 무접촉이다. 접은 것은 화면뿐이다. */
      { source: "/hot", destination: "/apt", permanent: true },
      { source: "/shop/megaphone", destination: "/", permanent: true },
      { source: "/shop", destination: "/", permanent: true },
      { source: "/grades", destination: "/", permanent: true },
      { source: "/premium", destination: "/", permanent: true },

      { source: "/api/stock-debug", destination: "/", permanent: true },
      { source: "/api/stock-debug/:path*", destination: "/", permanent: true },
      { source: "/rss", destination: "/feed.xml", permanent: true },
      { source: "/rss.xml", destination: "/feed.xml", permanent: true },
      { source: "/sitemap", destination: "/sitemap.xml", permanent: true },
      // [P0-DELETE] 삼익비치 auto_issue 팩트 오류 4편 → Pillar로 통합 301
      { source: "/blog/samik-beach-spoke-d1-general-sale-analysis", destination: "/blog/samik-beach-redev-complete-guide-2026", permanent: true },
      { source: "/blog/samik-beach-real-transaction-price-analysis-2023-2025", destination: "/blog/samik-beach-redev-complete-guide-2026", permanent: true },
      { source: "/blog/samik-beach-reconstruction-2026-stage3-progress", destination: "/blog/samik-beach-redev-complete-guide-2026", permanent: true },
      { source: "/blog/samik-beach-contribution-simulation-spoke-c1", destination: "/blog/samik-beach-redev-complete-guide-2026", permanent: true },

      /**
       * [CV-N N-0] 이중 레코드 통합 (2026-09-08).
       *
       * 「아크로 라로체」는 «이름이 촉진3, 별칭이 촉진1» 인 오표기 레코드였고(dong 도 촉진1의 부암동),
       * 「부산 우동1 재건축」은 「우동1 재건축」의 이중이었다(별칭이 ["부산","재건축"] 조각).
       *
       * ⚠️ 광고 착지 17건을 «먼저» 정본으로 옮긴 뒤에 이 리다이렉트를 켠다. 순서를 뒤집으면
       *    그동안 광고 트래픽이 리다이렉트를 한 번 경유한다.
       * ⚠️ permanent: true 는 Next 에서 308 이다. 검색엔진이 정본으로 통합하는 것이 의도다.
       */
      { source: "/apt/아크로-라로체", destination: "/apt/시민공원주변재정비촉진3구역-재개발", permanent: true },
      { source: "/apt/부산-우동1-재건축", destination: "/apt/우동1-재건축", permanent: true },
      /**
       * ⚠️ 퍼센트 인코딩 형태도 «따로» 등록한다. 2026-09-08 실측: 한글 source 만 두었더니
       *    브라우저가 보내는 인코딩된 경로(/apt/%EC%95%84...)와 매칭되지 않아
       *    308 이 아니라 **200** 이 나왔다. Next 는 source 를 디코딩해 비교하지 않는다.
       *    ⛔ 「리다이렉트를 넣었다」로 끝내지 않고 실제 응답 코드를 쟀기에 잡혔다.
       */
      { source: "/apt/%EC%95%84%ED%81%AC%EB%A1%9C-%EB%9D%BC%EB%A1%9C%EC%B2%B4", destination: "/apt/시민공원주변재정비촉진3구역-재개발", permanent: true },
      { source: "/apt/%EB%B6%80%EC%82%B0-%EC%9A%B0%EB%8F%991-%EC%9E%AC%EA%B1%B4%EC%B6%95", destination: "/apt/우동1-재건축", permanent: true },
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
