import { NextResponse } from 'next/server';

export function GET() {
  const body = `# ===== 카더라 (kadeora.app) — Crawl Directives =====

# ===== 공통 =====
User-agent: *
Allow: /
Allow: /feed/
Allow: /stock/
Allow: /apt/
Allow: /blog/
Allow: /daily/
Allow: /discuss
Disallow: /admin/
Disallow: /payment/
Disallow: /api/
Disallow: /profile/
Disallow: /write
Disallow: /onboarding
Disallow: /shop/
Disallow: /consultant/
Disallow: /login
Disallow: /signup
Disallow: /notifications

# ===== Google =====
User-agent: Googlebot
Allow: /
Allow: /apt/
Allow: /blog/
Allow: /api/og
Allow: /images/
Crawl-delay: 0
Disallow: /admin/
Disallow: /api/cron
Disallow: /api/admin

User-agent: Googlebot-Image
Allow: /api/og
Allow: /api/og-square
Allow: /images/
Allow: /image-sitemap.xml

# ===== Naver (Yeti) =====
User-agent: Yeti
Allow: /
Allow: /apt/
Allow: /blog/
Allow: /feed.xml
Allow: /api/og
Allow: /api/og-square
Allow: /images/
Crawl-delay: 1
Disallow: /admin/
Disallow: /api/cron
Disallow: /api/admin

# ===== Bing =====
User-agent: Bingbot
Allow: /
Allow: /apt/
Allow: /blog/
Allow: /api/og
Allow: /api/og-square
Allow: /images/
Crawl-delay: 0
Disallow: /admin/
Disallow: /api/cron
Disallow: /api/admin

# ===== Daum =====
User-agent: DaumCrawler
Allow: /
Allow: /apt/
Allow: /blog/
Allow: /api/og
Allow: /images/
Crawl-delay: 1
Disallow: /admin/
Disallow: /api/cron
Disallow: /api/admin

# ===== Zum =====
User-agent: ZumBot
Allow: /
Allow: /apt/
Allow: /blog/
Crawl-delay: 2
Disallow: /admin/
Disallow: /api/

# ===== AI Crawlers (ChatGPT, Claude, Perplexity) =====
User-agent: GPTBot
Allow: /apt/
Allow: /blog/
Disallow: /admin/
Disallow: /api/

User-agent: Claude-Web
Allow: /apt/
Allow: /blog/
Disallow: /admin/
Disallow: /api/

User-agent: PerplexityBot
Allow: /apt/
Allow: /blog/
Disallow: /admin/
Disallow: /api/

# ===== Sitemaps =====
Sitemap: https://kadeora.app/sitemap.xml
Sitemap: https://kadeora.app/image-sitemap.xml
Sitemap: https://kadeora.app/feed.xml
Sitemap: https://kadeora.app/stock/feed
Sitemap: https://kadeora.app/apt/feed
Host: https://kadeora.app

# ===== Daum Verification =====
#DaumWebMasterTool:a1f328fa8487fd3f97d35c70ed840a8d8b26f74e27f5957b99540d4bb1956a83:cSy+fiTk3RyjyaVEHfCydQ==
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
