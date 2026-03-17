import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/feed/', '/stock/', '/apt/', '/discuss'],
        disallow: ['/admin/', '/payment/', '/api/', '/profile/', '/write', '/onboarding', '/shop/'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/feed/', '/stock/', '/apt/'],
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'Yeti',
        allow: ['/', '/feed/', '/stock/', '/apt/'],
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: 'https://kadeora.app/sitemap.xml',
    host: 'https://kadeora.app',
  };
}
