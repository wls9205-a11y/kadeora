import type { MetadataRoute } from 'next';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/onboarding', '/payment', '/write', '/profile/'] },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}