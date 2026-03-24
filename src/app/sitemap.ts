import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { MetadataRoute } from 'next';

import { SITE_URL as BASE } from '@/lib/constants';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    '', '/feed', '/hot', '/stock', '/apt', '/discuss', '/blog',
    '/guide', '/search', '/faq', '/terms', '/privacy', '/refund',
    '/apt/map', '/apt/diagnose', '/apt/search', '/stock/compare', '/blog/series',
  ].map(path => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === '/feed' || path === '/stock' || path === '/apt' ? 0.9 : 0.7,
  }));

  // 지역별 SEO 랜딩 페이지
  const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주','강남구','서초구','송파구','마포구','용산구','성남시','수원시','고양시','화성시','평택시','해운대구','부산진구','동래구'];
  const regionPages: MetadataRoute.Sitemap = REGIONS.map(r => ({
    url: `${BASE}/apt/region/${encodeURIComponent(r)}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  let blogPages: MetadataRoute.Sitemap = [];
  let stockPages: MetadataRoute.Sitemap = [];
  let aptPages: MetadataRoute.Sitemap = [];
  let feedPages: MetadataRoute.Sitemap = [];
  let sitePages: MetadataRoute.Sitemap = [];

  try {
    const supabase = getSupabaseAdmin();

    const [blogsR, stocksR, aptsR, seriesR, postsR, sitesR] = await Promise.all([
      supabase.from('blog_posts').select('slug, updated_at, published_at')
        .eq('is_published', true).not('published_at', 'is', null)
        .lte('published_at', now.toISOString())
        .order('published_at', { ascending: false }).limit(50000),
      supabase.from('stock_quotes').select('symbol, updated_at'),
      supabase.from('apt_subscriptions').select('house_manage_no, updated_at').order('rcept_bgnde', { ascending: false }).limit(0), // apt URLs now use apt_sites slugs
      supabase.from('blog_series').select('slug, created_at').eq('is_active', true),
      supabase.from('posts').select('id, slug, created_at, updated_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5000),
      supabase.from('apt_sites').select('slug, updated_at, site_type, content_score, sitemap_wave, interest_count')
        .eq('is_active', true).gte('content_score', 25)
        .order('interest_count', { ascending: false }).limit(10000),
    ]);

    blogPages = (blogsR.data || []).map(b => {
      const pubDate = new Date(b.published_at || b.updated_at || Date.now());
      const daysSincePub = Math.floor((Date.now() - pubDate.getTime()) / 86400000);
      return {
        url: `${BASE}/blog/${b.slug}`,
        lastModified: new Date(b.updated_at || b.published_at || Date.now()),
        changeFrequency: (daysSincePub <= 7 ? 'daily' : daysSincePub <= 30 ? 'weekly' : 'monthly') as 'daily' | 'weekly' | 'monthly',
        priority: daysSincePub <= 3 ? 0.8 : daysSincePub <= 14 ? 0.7 : daysSincePub <= 60 ? 0.6 : 0.5,
      };
    });

    stockPages = (stocksR.data || []).map(s => ({
      url: `${BASE}/stock/${s.symbol}`,
      lastModified: new Date(s.updated_at || Date.now()),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    aptPages = (aptsR.data || []).map(a => ({
      url: `${BASE}/apt/${a.house_manage_no}`,
      lastModified: new Date(a.updated_at || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    const seriesPages = (seriesR.data || []).map((s: any) => ({
      url: `${BASE}/blog/series/${s.slug}`,
      lastModified: new Date(s.created_at || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    blogPages = [...blogPages, ...seriesPages];

    feedPages = (postsR.data || []).map((p: any) => ({
      url: `${BASE}/feed/${p.slug || p.id}`,
      lastModified: new Date(p.updated_at || p.created_at || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

    sitePages = (sitesR.data || []).map((s: any) => ({
      url: `${BASE}/apt/${s.slug}`,
      lastModified: new Date(s.updated_at || Date.now()),
      changeFrequency: (s.site_type === 'subscription' ? 'daily' : 'weekly') as const,
      priority: s.site_type === 'subscription' ? 0.85 : (s.interest_count > 0 ? 0.8 : 0.7),
    }));
  } catch {}

  return [...staticPages, ...regionPages, ...blogPages, ...stockPages, ...aptPages, ...feedPages, ...sitePages];
}
