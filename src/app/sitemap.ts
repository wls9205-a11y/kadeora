import { createClient } from '@supabase/supabase-js';
import { MetadataRoute } from 'next';

const BASE = 'https://kadeora.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    '', '/feed', '/hot', '/stock', '/apt', '/discuss', '/blog',
    '/guide', '/search', '/faq', '/terms', '/privacy',
  ].map(path => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === '/feed' || path === '/stock' || path === '/apt' ? 0.9 : 0.7,
  }));

  let blogPages: MetadataRoute.Sitemap = [];
  let stockPages: MetadataRoute.Sitemap = [];
  let aptPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [blogsR, stocksR, aptsR] = await Promise.all([
      supabase.from('blog_posts').select('slug, updated_at, published_at')
        .eq('is_published', true).not('published_at', 'is', null)
        .lte('published_at', now.toISOString())
        .order('published_at', { ascending: false }).limit(50000),
      supabase.from('stock_quotes').select('symbol, updated_at'),
      supabase.from('apt_subscriptions').select('house_manage_no, created_at').order('rcept_bgnde', { ascending: false }).limit(5000),
    ]);

    blogPages = (blogsR.data || []).map(b => ({
      url: `${BASE}/blog/${b.slug}`,
      lastModified: new Date(b.updated_at || b.published_at || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    stockPages = (stocksR.data || []).map(s => ({
      url: `${BASE}/stock/${s.symbol}`,
      lastModified: new Date(s.updated_at || Date.now()),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    aptPages = (aptsR.data || []).map(a => ({
      url: `${BASE}/apt/${a.house_manage_no}`,
      lastModified: new Date(a.created_at || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {}

  return [...staticPages, ...blogPages, ...stockPages, ...aptPages];
}
