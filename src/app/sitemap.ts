import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { MetadataRoute } from 'next';
import { SITE_URL as BASE } from '@/lib/constants';

const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주','강남구','서초구','송파구','마포구','용산구','성남시','수원시','고양시','화성시','평택시','해운대구','부산진구','동래구'];
const BLOG_PER_SITEMAP = 5000;

/** 사이트맵 인덱스 — DB 호출 없이 고정 ID 반환 (빌드 타임 DB 미접근 방어) */
export async function generateSitemaps() {
  return [
    { id: 0 },  // static + region + sector
    { id: 1 },  // stock
    { id: 2 },  // apt-sites
    { id: 3 },  // feed posts
    { id: 4 },  // discuss
    { id: 10 }, // blog chunk 0
    { id: 11 }, // blog chunk 1
    { id: 12 }, // blog chunk 2
    { id: 13 }, // blog chunk 3
  ];
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const now = new Date();

  // ── 0: static + region ──
  if (id === 0) {
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
    const regionPages: MetadataRoute.Sitemap = REGIONS.map(r => ({
      url: `${BASE}/apt/region/${encodeURIComponent(r)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    const SECTORS = ['반도체','금융','자동차','바이오','화학','철강','건설','유통','IT','에너지','통신','엔터','방산','조선'];
    const sectorPages: MetadataRoute.Sitemap = SECTORS.map(s => ({
      url: `${BASE}/stock/sector/${encodeURIComponent(s)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    return [...staticPages, ...regionPages, ...sectorPages];
  }

  // ── 1: stock ──
  if (id === 1) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from('stock_quotes').select('symbol, updated_at');
      return (data || []).map(s => ({
        url: `${BASE}/stock/${s.symbol}`,
        lastModified: new Date(s.updated_at || Date.now()),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }));
    } catch { return []; }
  }

  // ── 2: apt-sites ──
  if (id === 2) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from('apt_sites')
        .select('slug, updated_at, site_type, interest_count')
        .eq('is_active', true).gte('content_score', 25)
        .order('interest_count', { ascending: false }).limit(10000);
      const typePriority: Record<string, number> = { subscription: 0.85, trade: 0.8, redevelopment: 0.75, unsold: 0.7, landmark: 0.8 };
      const typeFreq: Record<string, 'daily' | 'weekly' | 'monthly'> = { subscription: 'daily', trade: 'weekly', redevelopment: 'weekly', unsold: 'weekly', landmark: 'monthly' };
      return (data || []).map((s: any) => ({
        url: `${BASE}/apt/${s.slug}`,
        lastModified: new Date(s.updated_at || Date.now()),
        changeFrequency: typeFreq[s.site_type] || 'weekly',
        priority: s.interest_count > 0 ? Math.min((typePriority[s.site_type] || 0.7) + 0.05, 0.95) : typePriority[s.site_type] || 0.7,
      }));
    } catch { return []; }
  }

  // ── 3: feed posts ──
  if (id === 3) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from('posts')
        .select('id, slug, updated_at, created_at')
        .eq('is_deleted', false).order('created_at', { ascending: false }).limit(5000);
      return (data || []).map((p: any) => ({
        url: `${BASE}/feed/${p.slug || p.id}`,
        lastModified: new Date(p.updated_at || p.created_at || Date.now()),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }));
    } catch { return []; }
  }

  // ── 4: discuss ──
  if (id === 4) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from('discussion_topics')
        .select('id, created_at, comment_count, vote_a, vote_b')
        .order('created_at', { ascending: false }).limit(1000);
      return (data || []).map((d: any) => {
        const engagement = (d.vote_a || 0) + (d.vote_b || 0) + (d.comment_count || 0);
        return {
          url: `${BASE}/discuss/${d.id}`,
          lastModified: new Date(d.created_at || Date.now()),
          changeFrequency: 'weekly' as const,
          priority: engagement > 50 ? 0.7 : engagement > 10 ? 0.6 : 0.5,
        };
      });
    } catch { return []; }
  }

  // ── 10+: blog chunks ──
  if (id >= 10) {
    try {
      const supabase = getSupabaseAdmin();
      const chunk = id - 10;
      const offset = chunk * BLOG_PER_SITEMAP;
      const { data } = await supabase.from('blog_posts')
        .select('slug, updated_at, published_at')
        .eq('is_published', true).not('published_at', 'is', null)
        .lte('published_at', now.toISOString())
        .order('published_at', { ascending: false })
        .range(offset, offset + BLOG_PER_SITEMAP - 1);

      // 첫 청크에 시리즈 페이지도 포함
      let seriesPages: MetadataRoute.Sitemap = [];
      if (chunk === 0) {
        try {
          const { data: series } = await supabase.from('blog_series').select('slug, created_at').eq('is_active', true);
          seriesPages = (series || []).map((s: any) => ({
            url: `${BASE}/blog/series/${s.slug}`,
            lastModified: new Date(s.created_at || Date.now()),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
          }));
        } catch {}
      }

      const blogPages = (data || []).map(b => {
        const pubDate = new Date(b.published_at || b.updated_at || Date.now());
        const daysSincePub = Math.floor((Date.now() - pubDate.getTime()) / 86400000);
        return {
          url: `${BASE}/blog/${b.slug}`,
          lastModified: new Date(b.updated_at || b.published_at || Date.now()),
          changeFrequency: (daysSincePub <= 7 ? 'daily' : daysSincePub <= 30 ? 'weekly' : 'monthly') as 'daily' | 'weekly' | 'monthly',
          priority: daysSincePub <= 3 ? 0.8 : daysSincePub <= 14 ? 0.7 : daysSincePub <= 60 ? 0.6 : 0.5,
        };
      });

      return [...seriesPages, ...blogPages];
    } catch { return []; }
  }

  return [];
}
