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
    { url: `${SITE}/blog`,     lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
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

    const [postsResult, stocksResult, aptsResult, blogResult] = await Promise.all([
      timeout(sb.from('posts').select('id, slug, updated_at, likes_count, comments_count').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5000), 10000),
      timeout(sb.from('stock_quotes').select('symbol, updated_at'), 5000),
      timeout(sb.from('apt_subscriptions').select('id, house_manage_no, updated_at'), 5000),
      timeout(sb.from('blog_posts').select('slug, updated_at, cover_image').eq('is_published', true).order('created_at', { ascending: false }).limit(1000), 5000),
    ]);

    const posts = (postsResult as any)?.data ?? [];
    const stocks = (stocksResult as any)?.data ?? [];
    const apts = (aptsResult as any)?.data ?? [];

    const feedRoutes: MetadataRoute.Sitemap = posts.map((p: any) => ({
      url: `${SITE}/feed/${p.slug || p.id}`,
      lastModified: new Date(p.updated_at ?? Date.now()),
      changeFrequency: 'weekly' as const,
      priority: (p.likes_count >= 5 || p.comments_count >= 3) ? 0.8 : 0.6,
    }));

    const activeStocks = stocks.filter((s: any) => {
      if (!s.updated_at) return false;
      return new Date(s.updated_at).getFullYear() > 2000;
    });
    const stockRoutes: MetadataRoute.Sitemap = activeStocks.map((s: any) => ({
      url: `${SITE}/stock/${s.symbol}`,
      lastModified: new Date(s.updated_at ?? Date.now()),
      changeFrequency: 'hourly' as const,
      priority: 0.7,
    }));

    const aptRoutes: MetadataRoute.Sitemap = apts.map((a: any) => ({
      url: `${SITE}/apt/${a.house_manage_no || a.id}`,
      lastModified: new Date(a.updated_at ?? Date.now()),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    const blogs = (blogResult as any)?.data ?? [];
    const blogRoutes: MetadataRoute.Sitemap = blogs.map((b: any) => ({
      url: `${SITE}/blog/${b.slug}`,
      lastModified: new Date(b.updated_at ?? Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      ...(b.cover_image ? { images: [b.cover_image] } : {}),
    }));

    return [...staticRoutes, ...feedRoutes, ...stockRoutes, ...aptRoutes, ...blogRoutes];
  } catch {
    return staticRoutes;
  }
}
