import { NextResponse } from 'next/server';

export function GET() {
  const body = `User-agent: *
Allow: /
Allow: /feed/
Allow: /stock/
Allow: /apt/
Allow: /blog/
Allow: /discuss
Disallow: /admin/
Disallow: /payment/
Disallow: /api/
Disallow: /profile/
Disallow: /write
Disallow: /onboarding
Disallow: /shop/

User-agent: Googlebot
Allow: /
Allow: /feed/
Allow: /stock/
Allow: /apt/
Allow: /blog/
Disallow: /admin/
Disallow: /api/

User-agent: Yeti
Allow: /
Allow: /feed/
Allow: /stock/
Allow: /apt/
Allow: /blog/
Disallow: /admin/
Disallow: /api/

Sitemap: https://kadeora.app/sitemap.xml
Host: https://kadeora.app

#DaumWebMasterTool:a1f328fa8487fd3f97d35c70ed840a8d8b26f74e27f5957b99540d4bb1956a83:cSy+fiTk3RyjyaVEHfCydQ==
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
