import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE,               lastModified: new Date(), changeFrequency: 'daily',   priority: 1 },
    { url: `${SITE}/feed`,     lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${SITE}/stock`,    lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.8 },
    { url: `${SITE}/apt`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${SITE}/discuss`,  lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.7 },
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
    const { data: posts } = await sb
      .from('posts')
      .select('id, updated_at')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(200);

    const feedRoutes: MetadataRoute.Sitemap = (posts ?? []).map(p => ({
      url: `${SITE}/feed/${p.id}`,
      lastModified: new Date(p.updated_at ?? Date.now()),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

    return [...staticRoutes, ...feedRoutes];
  } catch {
    return staticRoutes;
  }
}