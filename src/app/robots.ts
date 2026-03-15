import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.vercel.app';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/auth/', '/payment', '/profile/'] },
      { userAgent: 'Googlebot', allow: '/', disallow: ['/api/', '/auth/'] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
