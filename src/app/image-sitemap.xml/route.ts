import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as BASE } from '@/lib/constants';

export const revalidate = 3600; // 1시간 캐시

/**
 * 이미지 사이트맵 — Google/Naver 이미지 검색 채널
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 * 
 * 포함 대상:
 * 1. apt_sites — 현장 이미지 (네이버 이미지 검색 수집분)
 * 2. blog_posts — 블로그 커버 이미지 (정적 URL만, /api/og 동적 URL 필터)
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  const [sitesR, blogsR] = await Promise.all([
    sb.from('apt_sites')
      .select('slug, name, images, region, sigungu')
      .eq('is_active', true)
      .gte('content_score', 25)
      .not('images', 'is', null)
      .limit(10000),
    sb.from('blog_posts')
      .select('slug, title, cover_image, image_alt, category')
      .eq('is_published', true)
      .not('cover_image', 'is', null)
      // /api/og 동적 URL도 포함 (Googlebot-Image, Yeti가 렌더링 가능)
      .order('published_at', { ascending: false })
      .limit(50000),
  ]);

  const entries: string[] = [];

  // ━━━ 부동산 현장 이미지 ━━━
  for (const s of sitesR.data || []) {
    const imgs = Array.isArray(s.images) ? s.images : [];
    if (imgs.length === 0) continue;

    const imageXml = imgs.slice(0, 10).map((img: any) => {
      const url = typeof img === 'string' ? img : img?.link || img?.url;
      if (!url) return '';
      const title = typeof img === 'object' && img?.title
        ? escapeXml(img.title)
        : escapeXml(`${s.name} ${s.region || ''} ${s.sigungu || ''}`.trim());
      const caption = s.region && s.sigungu
        ? escapeXml(`${s.region} ${s.sigungu} ${s.name} 분양 현장`)
        : escapeXml(`${s.name} 분양 현장`);
      return `      <image:image>
        <image:loc>${escapeXml(url)}</image:loc>
        <image:title>${title}</image:title>
        <image:caption>${caption}</image:caption>
      </image:image>`;
    }).filter(Boolean).join('\n');

    if (imageXml) {
      entries.push(`  <url>
    <loc>${BASE}/apt/${encodeURIComponent(s.slug)}</loc>
${imageXml}
  </url>`);
    }
  }

  // ━━━ 블로그 커버 이미지 ━━━
  for (const b of blogsR.data || []) {
    if (!b.cover_image) continue;
    const catLabel = b.category === 'stock' ? '주식' : b.category === 'apt' ? '부동산' : b.category === 'unsold' ? '미분양' : '재테크';
    entries.push(`  <url>
    <loc>${BASE}/blog/${encodeURIComponent(b.slug)}</loc>
      <image:image>
        <image:loc>${escapeXml(b.cover_image)}</image:loc>
        <image:title>${escapeXml(b.image_alt || b.title)}</image:title>
        <image:caption>${escapeXml(`카더라 ${catLabel} 블로그 — ${b.title}`)}</image:caption>
      </image:image>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
