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

    const timeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([promise, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

    const [postsResult, stocksResult, aptsResult] = await Promise.all([
      timeout(sb.from('posts').select('id, updated_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(200), 5000),
      timeout(sb.from('stock_quotes').select('symbol, updated_at'), 5000),
      timeout(sb.from('apt_subscriptions').select('id, updated_at'), 5000),
    ]);

    const posts = (postsResult as any)?.data ?? [];
    const stocks = (stocksResult as any)?.data ?? [];
    const apts = (aptsResult as any)?.data ?? [];

    const feedRoutes: MetadataRoute.Sitemap = posts.map((p: any) => ({
      url: `${SITE}/feed/${p.id}`,
      lastModified: new Date(p.updated_at ?? Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    const stockRoutes: MetadataRoute.Sitemap = stocks.map((s: any) => ({
      url: `${SITE}/stock/${s.symbol}`,
      lastModified: new Date(s.updated_at ?? Date.now()),
      changeFrequency: 'hourly' as const,
      priority: 0.7,
    }));

    const aptRoutes: MetadataRoute.Sitemap = apts.map((a: any) => ({
      url: `${SITE}/apt/${a.id}`,
      lastModified: new Date(a.updated_at ?? Date.now()),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...feedRoutes, ...stockRoutes, ...aptRoutes];
  } catch {
    return staticRoutes;
  }
}
