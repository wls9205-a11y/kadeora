import { NextResponse } from 'next/server';

export function GET() {
  const body = `# ===== 카더라 (kadeora.app) — Crawl Directives =====

# ===== 공통 =====
User-agent: *
Allow: /
Allow: /feed/
Allow: /stock/
Allow: /apt/
Allow: /apt/sites/
Allow: /blog/
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

# ===== Google =====
User-agent: Googlebot
Allow: /
Allow: /apt/sites/
Allow: /blog/
Crawl-delay: 0
Disallow: /admin/
Disallow: /api/

User-agent: Googlebot-Image
Allow: /api/og
Allow: /images/

# ===== Naver (Yeti) =====
User-agent: Yeti
Allow: /
Allow: /apt/sites/
Allow: /blog/
Allow: /feed.xml
Crawl-delay: 1
Disallow: /admin/
Disallow: /api/

# ===== Bing =====
User-agent: Bingbot
Allow: /
Allow: /apt/sites/
Allow: /blog/
Crawl-delay: 0
Disallow: /admin/
Disallow: /api/

# ===== Daum =====
User-agent: DaumCrawler
Allow: /
Allow: /apt/sites/
Allow: /blog/
Crawl-delay: 1
Disallow: /admin/
Disallow: /api/

# ===== Zum =====
User-agent: ZumBot
Allow: /
Allow: /apt/sites/
Allow: /blog/
Crawl-delay: 2
Disallow: /admin/
Disallow: /api/

# ===== AI Crawlers (ChatGPT, Claude, Perplexity) =====
User-agent: GPTBot
Allow: /apt/sites/
Allow: /blog/
Disallow: /admin/
Disallow: /api/

User-agent: Claude-Web
Allow: /apt/sites/
Allow: /blog/
Disallow: /admin/
Disallow: /api/

User-agent: PerplexityBot
Allow: /apt/sites/
Allow: /blog/
Disallow: /admin/
Disallow: /api/

# ===== Sitemaps =====
Sitemap: https://kadeora.app/sitemap.xml
Host: https://kadeora.app

# ===== RSS Feeds =====
# Main: https://kadeora.app/feed.xml
# Stock: https://kadeora.app/feed.xml?category=stock
# Real Estate: https://kadeora.app/feed.xml?category=apt
# Finance: https://kadeora.app/feed.xml?category=finance
# Unsold: https://kadeora.app/feed.xml?category=unsold

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
