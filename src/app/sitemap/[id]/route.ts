import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as BASE } from '@/lib/constants';

export const revalidate = 3600;

const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주','강남구','서초구','송파구','마포구','용산구','성남시','수원시','고양시','화성시','평택시','해운대구','부산진구','동래구'];
const SECTORS_FALLBACK = ['반도체','금융','자동차','바이오','IT','에너지','ETF','방산'];
const BLOG_PER_SITEMAP = 5000;

interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFrequency: string;
  priority: number;
}

function toXml(entries: SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastModified}</lastmod>
    <changefreq>${e.changeFrequency}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
}

function xmlResponse(entries: SitemapEntry[]) {
  return new NextResponse(toXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await props.params;
  const id = Number(rawId.replace('.xml', ''));
  const now = new Date().toISOString();
  const buildDate = '2026-04-08T00:00:00Z'; // Static pages: fixed lastmod

  // ── 0: static + region + sector ──
  if (id === 0) {
    const sb = getSupabaseAdmin();
    // 섹터 목록: DB에서 동적 조회 (새 종목/섹터 추가 시 자동 반영)
    let SECTORS = SECTORS_FALLBACK;
    try {
      const { data: sectorData } = await sb.from('stock_quotes')
        .select('sector')
        .not('sector', 'is', null)
        .neq('sector', '')
        .gt('price', 0);
      if (sectorData?.length) {
        SECTORS = [...new Set(sectorData.map((s: any) => s.sector as string))];
      }
    } catch {}

    const staticPaths = [
      '', '/feed', '/hot', '/stock', '/apt', '/discuss', '/blog', '/about',
      '/guide', '/search', '/faq', '/terms', '/privacy', '/refund', 
      '/grades', '/daily', '/apt/map', '/apt/diagnose', '/apt/search', '/apt/complex', '/stock/compare', '/blog/series',
      '/apt/data', '/stock/data', '/stock/search', '/stock/dividend', '/stock/movers', '/stock/themes',
      '/stock/market/kospi', '/stock/market/kosdaq', '/stock/market/nyse', '/stock/market/nasdaq',
      '/calc', '/about/team', '/press',
    ];
    // 계산기 동적 URL
    let calcPaths: string[] = [];
    try {
      const { CALC_REGISTRY, CATEGORIES } = await import('@/lib/calc/registry');
      calcPaths = [
        ...CATEGORIES.map(c => `/calc/${c.id}`),
        ...CALC_REGISTRY.map(c => `/calc/${c.category}/${c.slug}`),
      ];
    } catch {}
    const entries: SitemapEntry[] = [
      ...staticPaths.map(path => ({
        url: `${BASE}${path}`,
        lastModified: buildDate,
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : ['/feed', '/stock', '/apt'].includes(path) ? 0.9 : 0.7,
      })),
      ...calcPaths.map(path => ({
        url: `${BASE}${path}`,
        lastModified: now,
        changeFrequency: 'monthly' as string,
        priority: path === '/calc' ? 0.9 : 0.8,
      })),
      ...REGIONS.map(r => ({
        url: `${BASE}/apt/region/${encodeURIComponent(r)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
      ...SECTORS.map(s => ({
        url: `${BASE}/stock/sector/${encodeURIComponent(s)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
      // 카더라 데일리 리포트 — 17개 지역
      ...['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'].flatMap(r => [
        { url: `${BASE}/daily/${encodeURIComponent(r)}`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
        { url: `${BASE}/daily/${encodeURIComponent(r)}/archive`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
      ]),
    ];
    return xmlResponse(entries);
  }

  // ── 1: stock ──
  if (id === 1) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb.from('stock_quotes').select('symbol, updated_at');
      return xmlResponse((data || []).map(s => ({
        url: `${BASE}/stock/${s.symbol}`,
        lastModified: s.updated_at || now,
        changeFrequency: 'daily',
        priority: 0.8,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 2: apt-sites ──
  if (id === 2) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb.from('apt_sites')
        .select('slug, updated_at, site_type, interest_count')
        .eq('is_active', true).gte('content_score', 25)
        .order('interest_count', { ascending: false }).limit(10000);
      const typePriority: Record<string, number> = { subscription: 0.85, trade: 0.8, redevelopment: 0.75, unsold: 0.7, landmark: 0.8 };
      const typeFreq: Record<string, string> = { subscription: 'daily', trade: 'weekly', redevelopment: 'weekly', unsold: 'weekly', landmark: 'monthly' };
      return xmlResponse((data || []).map((s: any) => ({
        url: `${BASE}/apt/${s.slug}`,
        lastModified: s.updated_at || now,
        changeFrequency: typeFreq[s.site_type] || 'weekly',
        priority: s.interest_count > 0 ? Math.min((typePriority[s.site_type] || 0.7) + 0.05, 0.95) : typePriority[s.site_type] || 0.7,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 3: feed posts ──
  if (id === 3) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb.from('posts')
        .select('id, slug, updated_at, created_at')
        .eq('is_deleted', false).order('created_at', { ascending: false }).limit(5000);
      return xmlResponse((data || []).map((p: any) => ({
        url: `${BASE}/feed/${p.slug || p.id}`,
        lastModified: p.updated_at || p.created_at || now,
        changeFrequency: 'weekly',
        priority: 0.5,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 4: discuss ──
  if (id === 4) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb.from('discussion_topics')
        .select('id, created_at, comment_count, vote_a, vote_b')
        .order('created_at', { ascending: false }).limit(1000);
      return xmlResponse((data || []).map((d: any) => {
        const engagement = (d.vote_a || 0) + (d.vote_b || 0) + (d.comment_count || 0);
        return {
          url: `${BASE}/discuss/${d.id}`,
          lastModified: d.created_at || now,
          changeFrequency: 'weekly',
          priority: engagement > 50 ? 0.7 : engagement > 10 ? 0.6 : 0.5,
        };
      }));
    } catch { return xmlResponse([]); }
  }

  // ── 5~7: complex profiles (단지백과) + image 태그 ──
  const COMPLEX_PER_SITEMAP = 12000;
  if (id >= 5 && id <= 7) {
    try {
      const sb = getSupabaseAdmin();
      const chunk = id - 5;
      const offset = chunk * COMPLEX_PER_SITEMAP;
      const { data } = await (sb as any).from('apt_complex_profiles')
        .select('apt_name, region_nm, sigungu, updated_at, sale_count_1y, rent_count_1y')
        .not('age_group', 'is', null)
        .order('sale_count_1y', { ascending: false })
        .range(offset, offset + COMPLEX_PER_SITEMAP - 1);

      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const complexXml = (data || []).map((p: any) => {
        const activity = (p.sale_count_1y || 0) + (p.rent_count_1y || 0);
        const prio = activity > 100 ? 0.8 : activity > 20 ? 0.7 : 0.6;
        const freq = activity > 50 ? 'weekly' : 'monthly';
        return `  <url>
    <loc>${BASE}/apt/complex/${encodeURIComponent(p.apt_name)}</loc>
    <lastmod>${p.updated_at || now}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
    <image:image>
      <image:loc>${BASE}/api/og?title=${encodeURIComponent(p.apt_name)}&amp;design=2&amp;category=apt</image:loc>
      <image:title>${esc(p.apt_name)} 아파트 실거래가</image:title>
      <image:caption>${esc((p.region_nm || '') + ' ' + (p.sigungu || '') + ' ' + p.apt_name)} 시세</image:caption>
    </image:image>
  </url>`;
      }).join('\n');

      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${complexXml}
</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
    } catch { return xmlResponse([]); }
  }

  // ── 21: area hubs (시군구 + 동 허브) ──
  if (id === 21) {
    try {
      const sb = getSupabaseAdmin();
      const entries: SitemapEntry[] = [];
      // 시군구 (10개+ 단지만)
      const { data: sgd } = await (sb as any).from('apt_complex_profiles').select('region_nm, sigungu').not('age_group', 'is', null).not('sigungu', 'is', null);
      const sgMap = new Map<string, number>();
      for (const r of (sgd || [])) { const k = `${r.region_nm}|${r.sigungu}`; sgMap.set(k, (sgMap.get(k) || 0) + 1); }
      for (const [k, c] of sgMap) { if (c < 10) continue; const [reg, sg] = k.split('|'); if (!reg || !sg) continue; entries.push({ url: `${BASE}/apt/area/${encodeURIComponent(reg)}/${encodeURIComponent(sg)}`, lastModified: now, changeFrequency: 'weekly', priority: c > 200 ? 0.85 : c > 50 ? 0.75 : 0.65 }); }
      // 동 (5개+ 단지만)
      const { data: dd } = await (sb as any).from('apt_complex_profiles').select('region_nm, sigungu, dong').not('age_group', 'is', null).not('dong', 'is', null).neq('dong', '');
      const dMap = new Map<string, number>();
      for (const r of (dd || [])) { const k = `${r.region_nm}|${r.sigungu}|${r.dong}`; dMap.set(k, (dMap.get(k) || 0) + 1); }
      for (const [k, c] of dMap) { if (c < 5) continue; const [reg, sg, dg] = k.split('|'); if (!reg || !sg || !dg) continue; entries.push({ url: `${BASE}/apt/area/${encodeURIComponent(reg)}/${encodeURIComponent(sg)}/${encodeURIComponent(dg)}`, lastModified: now, changeFrequency: 'monthly', priority: c > 30 ? 0.7 : 0.6 }); }
      return xmlResponse(entries);
    } catch { return xmlResponse([]); }
  }

  // ── 8+: blog chunks (image 사이트맵 포함) ──
  if (id >= 8) {
    try {
      const sb = getSupabaseAdmin();
      const chunk = id - 8;
      const offset = chunk * BLOG_PER_SITEMAP;
      const { data } = await sb.from('blog_posts')
        .select('slug, title, updated_at, published_at, cover_image, image_alt, category, source_type')
        .eq('is_published', true).not('published_at', 'is', null)
        .lte('published_at', now)
        .order('published_at', { ascending: false })
        .range(offset, offset + BLOG_PER_SITEMAP - 1);

      let seriesEntries: SitemapEntry[] = [];
      if (chunk === 0) {
        try {
          const { data: series } = await sb.from('blog_series').select('slug, created_at, updated_at').eq('is_active', true);
          seriesEntries = (series || []).map((s: any) => ({
            url: `${BASE}/blog/series/${s.slug}`,
            lastModified: s.updated_at || s.created_at || now,
            changeFrequency: 'weekly',
            priority: 0.7,
          }));
        } catch {}
      }

      // image 사이트맵 포함 XML 생성
      const escXml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const blogXml = (data || []).map(b => {
        const pubDate = new Date(b.published_at || b.updated_at || now);
        const daysSincePub = Math.floor((Date.now() - pubDate.getTime()) / 86400000);
        const freq = daysSincePub <= 7 ? 'daily' : daysSincePub <= 30 ? 'weekly' : 'monthly';
        const prio = b.source_type === 'upcoming' ? 0.9 : daysSincePub <= 3 ? 0.8 : daysSincePub <= 14 ? 0.7 : daysSincePub <= 60 ? 0.6 : 0.5;
        const lastmod = b.updated_at || b.published_at || now;
        const imgUrl = b.cover_image || `${BASE}/api/og?title=${encodeURIComponent((b.title || '').slice(0, 60))}&category=${b.category || 'blog'}&design=2`;
        const imgAlt = escXml(b.image_alt || b.title || '카더라 블로그');
        const imgTitle = escXml((b.title || '').slice(0, 80));
        return `  <url>
    <loc>${BASE}/blog/${b.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
    <image:image>
      <image:loc>${escXml(imgUrl)}</image:loc>
      <image:title>${imgTitle}</image:title>
      <image:caption>${imgAlt}</image:caption>
    </image:image>
    <image:image>
      <image:loc>${BASE}/api/og-infographic?title=${encodeURIComponent((b.title || '').slice(0, 40))}&amp;category=${b.category || 'blog'}&amp;type=summary</image:loc>
      <image:title>${escXml(b.title + ' 인포그래픽')}</image:title>
      <image:caption>${imgAlt}</image:caption>
    </image:image>
  </url>`;
      }).join('\n');

      const seriesXml = seriesEntries.map(e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastModified}</lastmod>
    <changefreq>${e.changeFrequency}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');

      const fullXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${seriesXml}
${blogXml}
</urlset>`;

      return new NextResponse(fullXml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch { return xmlResponse([]); }
  }

  return xmlResponse([]);
}
