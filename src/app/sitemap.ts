import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE,               lastModified: new Date(), changeFrequency: 'daily',   priority: 1 },
    { url: `${SITE}/feed`,     lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${SITE}/stock`,    lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.8 },
    { url: `${SITE}/apt`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${SITE}/discuss`,  lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.7 },
    { url: `${SITE}/hot`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${SITE}/guide`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/search`,   lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${SITE}/faq`,      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE}/terms`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE}/privacy`,  lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [{ data: posts }, { data: stocks }, { data: apts }] = await Promise.all([
      sb.from('posts').select('id, updated_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(200),
      sb.from('stock_quotes').select('symbol, updated_at'),
      sb.from('apt_subscriptions').select('id, updated_at'),
    ]);

    const feedRoutes: MetadataRoute.Sitemap = (posts ?? []).map(p => ({
      url: `${SITE}/feed/${p.id}`,
      lastModified: new Date(p.updated_at ?? Date.now()),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

    const stockRoutes: MetadataRoute.Sitemap = (stocks ?? []).map(s => ({
      url: `${SITE}/stock/${s.symbol}`,
      lastModified: new Date(s.updated_at ?? Date.now()),
      changeFrequency: 'hourly',
      priority: 0.7,
    }));

    const aptRoutes: MetadataRoute.Sitemap = (apts ?? []).map(a => ({
      url: `${SITE}/apt/${a.id}`,
      lastModified: new Date(a.updated_at ?? Date.now()),
      changeFrequency: 'daily',
      priority: 0.7,
    }));

    return [...staticRoutes, ...feedRoutes, ...stockRoutes, ...aptRoutes];
  } catch {
    return staticRoutes;
  }
}