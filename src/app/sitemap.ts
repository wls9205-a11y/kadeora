import { MetadataRoute } from 'next';
import { createSupabaseServer } from '@/lib/supabase-server';

const BASE = 'https://kadeora.app';

export async function generateSitemaps() {
  return [
    { id: 0 },  // static pages
    { id: 1 },  // blog posts
    { id: 2 },  // stock pages
    { id: 3 },  // apt pages
    { id: 4 },  // feed posts
  ];
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  if (id === 0) {
    // Static pages
    return [
      { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
      { url: `${BASE}/feed`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
      { url: `${BASE}/hot`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
      { url: `${BASE}/stock`, lastModified: now, changeFrequency: 'always', priority: 0.9 },
      { url: `${BASE}/apt`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
      { url: `${BASE}/discuss`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
      { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
      { url: `${BASE}/guide`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
      { url: `${BASE}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
      { url: `${BASE}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
      { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
      { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    ];
  }

  try {
    const sb = await createSupabaseServer();

    if (id === 1) {
      // Blog posts
      const { data: blogs } = await sb.from('blog_posts')
        .select('slug, updated_at, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      return (blogs || []).map(b => ({
        url: `${BASE}/blog/${b.slug}`,
        lastModified: b.updated_at || b.created_at || now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }

    if (id === 2) {
      // Stock pages
      const { data: stocks } = await sb.from('stock_quotes')
        .select('symbol, updated_at')
        .gt('updated_at', '2000-01-01')
        .limit(500);
      return (stocks || []).map(s => ({
        url: `${BASE}/stock/${s.symbol}`,
        lastModified: s.updated_at || now,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }));
    }

    if (id === 3) {
      // Apt pages
      const { data: apts } = await sb.from('apt_subscriptions')
        .select('house_manage_no, created_at')
        .order('rcept_bgnde', { ascending: false })
        .limit(500);
      return (apts || []).map(a => ({
        url: `${BASE}/apt/${a.house_manage_no}`,
        lastModified: a.created_at || now,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }

    if (id === 4) {
      // Feed posts (popular ones only)
      const { data: posts } = await sb.from('posts')
        .select('id, slug, updated_at, created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(500);
      return (posts || []).map(p => ({
        url: `${BASE}/feed/${p.slug || p.id}`,
        lastModified: p.updated_at || p.created_at || now,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }));
    }
  } catch {}

  return [];
}
