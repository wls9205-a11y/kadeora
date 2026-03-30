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

  const [sitesR, blogsR, stocksR, complexR] = await Promise.all([
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
      .order('published_at', { ascending: false })
      .limit(50000),
    sb.from('stock_quotes')
      .select('symbol, name, market, sector, price, change_pct, currency')
      .gt('price', 0)
      .limit(1000),
    (sb as any).from('apt_complex_profiles')
      .select('apt_name, region_nm, sigungu, age_group, latest_sale_price, latest_jeonse_price')
      .not('age_group', 'is', null)
      .gt('latest_sale_price', 0)
      .order('sale_count_1y', { ascending: false })
      .limit(5000),
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
    const ogSquareUrl = `${BASE}/api/og-square?title=${encodeURIComponent(b.title)}&category=${b.category}&author=${encodeURIComponent(b.category === 'stock' ? '카더라 주식팀' : '카더라 부동산팀')}`;
    entries.push(`  <url>
    <loc>${BASE}/blog/${encodeURIComponent(b.slug)}</loc>
      <image:image>
        <image:loc>${escapeXml(b.cover_image)}</image:loc>
        <image:title>${escapeXml(b.image_alt || b.title)}</image:title>
        <image:caption>${escapeXml(`카더라 ${catLabel} 블로그 — ${b.title}`)}</image:caption>
      </image:image>
      <image:image>
        <image:loc>${escapeXml(ogSquareUrl)}</image:loc>
        <image:title>${escapeXml(b.title)}</image:title>
        <image:caption>${escapeXml(`카더라 ${catLabel} — ${b.title} (1:1 이미지)`)}</image:caption>
      </image:image>
  </url>`);
  }

  // ━━━ 주식 종목 이미지 ━━━
  for (const s of stocksR.data || []) {
    const pct = Number(s.change_pct) || 0;
    const arrow = pct >= 0 ? '▲' : '▼';
    const priceStr = s.currency === 'USD' ? `$${Number(s.price).toFixed(2)}` : `₩${Number(s.price).toLocaleString()}`;
    const titleText = escapeXml(`${s.name} (${s.symbol}) ${priceStr} ${arrow}${Math.abs(pct).toFixed(2)}%`);
    const ogUrl = `${BASE}/api/og?title=${encodeURIComponent(`${s.name} (${s.symbol}) ${priceStr} ${arrow}${Math.abs(pct).toFixed(2)}%`)}&design=2&category=stock`;
    entries.push(`  <url>
    <loc>${BASE}/stock/${encodeURIComponent(s.symbol)}</loc>
      <image:image>
        <image:loc>${escapeXml(ogUrl)}</image:loc>
        <image:title>${titleText}</image:title>
        <image:caption>${escapeXml(`${s.name} ${s.market} 상장 ${s.sector || ''} 종목 주가 시세`)}</image:caption>
      </image:image>
  </url>`);
  }

  // ━━━ 단지백과 이미지 (OG + Square) ━━━
  for (const c of complexR.data || []) {
    const saleStr = c.latest_sale_price > 0 ? `매매 ${Math.round(c.latest_sale_price / 10000)}억` : '';
    const jeonseStr = c.latest_jeonse_price > 0 ? `전세 ${Math.round(c.latest_jeonse_price / 10000)}억` : '';
    const subtitle = [saleStr, jeonseStr].filter(Boolean).join(' · ') || '실거래가 시세';
    const ogUrl = `${BASE}/api/og?title=${encodeURIComponent(c.apt_name)}&design=2&category=apt&subtitle=${encodeURIComponent(subtitle)}&author=${encodeURIComponent('카더라 부동산팀')}`;
    const ogSquareUrl = `${BASE}/api/og-square?title=${encodeURIComponent(c.apt_name)}&category=apt&subtitle=${encodeURIComponent(subtitle)}`;
    const titleText = escapeXml(`${c.apt_name} ${c.region_nm} ${c.sigungu} ${c.age_group || ''} 아파트 실거래가`);
    entries.push(`  <url>
    <loc>${BASE}/apt/complex/${encodeURIComponent(c.apt_name)}</loc>
      <image:image>
        <image:loc>${escapeXml(ogUrl)}</image:loc>
        <image:title>${titleText}</image:title>
        <image:caption>${escapeXml(`${c.apt_name} 아파트 ${subtitle} — 카더라 단지백과`)}</image:caption>
      </image:image>
      <image:image>
        <image:loc>${escapeXml(ogSquareUrl)}</image:loc>
        <image:title>${titleText}</image:title>
        <image:caption>${escapeXml(`${c.apt_name} 단지백과 네이버 모바일용`)}</image:caption>
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
