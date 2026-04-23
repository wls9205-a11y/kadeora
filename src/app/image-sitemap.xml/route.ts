import { escapeXml } from '@/lib/xml-utils';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as BASE } from '@/lib/constants';

export const revalidate = 600; // 세션 149 E: 10분으로 단축, 커버리지 확장 반영 가속

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

  // 세션 149 E — PostgREST 1K cap 우회: range() 페이지네이션으로 전수 수집
  async function fetchAll(table: string, cols: string, filters: (q: any) => any, pageSize = 1000, maxPages = 40) {
    const all: any[] = [];
    for (let i = 0; i < maxPages; i++) {
      const q = (sb as any).from(table).select(cols);
      const filtered = filters(q);
      const { data } = await filtered.range(i * pageSize, (i + 1) * pageSize - 1);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
    }
    return all;
  }

  const [sitesData, blogsData, complexData] = await Promise.all([
    fetchAll('apt_sites', 'slug, name, images, region, sigungu',
      (q) => q.eq('is_active', true).not('images', 'is', null)),
    fetchAll('blog_posts', 'slug, title, cover_image, image_alt, category',
      (q) => q.eq('is_published', true).not('cover_image', 'is', null).order('published_at', { ascending: false })),
    fetchAll('apt_complex_profiles', 'apt_name, images, region_nm, sigungu',
      (q) => q.not('images', 'is', null)),
  ]);

  const sitesR = { data: sitesData };
  const blogsR = { data: blogsData };
  const complexR = { data: complexData };

  const entries: string[] = [];

  // ━━━ 부동산 현장 이미지 ━━━
  for (const s of sitesR.data || []) {
    const imgs = Array.isArray(s.images) ? s.images : [];
    if (imgs.length === 0) continue;

    const imageXml = imgs.slice(0, 10).map((img: any) => {
      let url = typeof img === 'string' ? img : img?.link || img?.url;
      if (!url) return '';
      url = url.replace(/^http:\/\//, 'https://');
      const title = typeof img === 'object' && img?.title
        ? escapeXml(img.title)
        : escapeXml(`${s.name} ${s.region || ''} ${s.sigungu || ''}`.trim());
      const caption = s.region && s.sigungu
        ? escapeXml(`${s.region} ${s.sigungu} ${s.name} 분양 현장`)
        : escapeXml(`${s.name} 분양 현장`);
      const geoLoc = s.region && s.sigungu
        ? `\n        <image:geo_location>${escapeXml(`${s.region} ${s.sigungu}`)}</image:geo_location>`
        : '';
      return `      <image:image>
        <image:loc>${escapeXml(url)}</image:loc>
        <image:title>${title}</image:title>
        <image:caption>${caption}</image:caption>${geoLoc}
      </image:image>`;
    }).filter(Boolean).join('\n');

    if (imageXml) {
      entries.push(`  <url>
    <loc>${BASE}/apt/${encodeURIComponent(s.slug)}</loc>
${imageXml}
  </url>`);
    }
  }

  // ━━━ 단지백과 이미지 (apt_complex_profiles) ━━━
  for (const c of (complexR.data || [])) {
    const imgs = Array.isArray(c.images) ? c.images : [];
    if (imgs.length === 0) continue;
    const imageXml = imgs.slice(0, 7).map((img: any) => {
      let url = typeof img === 'string' ? img : img?.url;
      if (!url) return '';
      url = url.replace(/^http:\/\//, 'https://');
      return `      <image:image>
        <image:loc>${escapeXml(url)}</image:loc>
        <image:title>${escapeXml(`${c.apt_name} 아파트 ${c.region_nm || ''} ${c.sigungu || ''}`.trim())}</image:title>
        <image:caption>${escapeXml(`${c.region_nm || ''} ${c.sigungu || ''} ${c.apt_name} 아파트 실거래가 시세`)}</image:caption>${c.region_nm && c.sigungu ? `\n        <image:geo_location>${escapeXml(`${c.region_nm} ${c.sigungu}`)}</image:geo_location>` : ''}
      </image:image>`;
    }).filter(Boolean).join('\n');
    if (imageXml) {
      entries.push(`  <url>
    <loc>${BASE}/apt/complex/${encodeURIComponent(c.apt_name)}</loc>
${imageXml}
  </url>`);
    }
  }

  // ━━━ 블로그 커버 이미지 (실제 이미지만 — /api/og 동적 URL 제외) ━━━
  for (const b of blogsR.data || []) {
    if (!b.cover_image) continue;
    // /api/og 동적 URL은 Google Image에서 인식 불가 → 제외
    if (b.cover_image.includes('/api/og')) continue;
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

  // ━━━ 주식 og-chart 인포그래픽 (서버 렌더 PNG — 캐시됨, 인덱싱 가능) ━━━
  const stocksR = await sb.from('stock_quotes')
    .select('symbol, name, sector')
    .eq('is_active', true).gt('price', 0)
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(500);
  for (const s of (stocksR.data || [])) {
    entries.push(`<url>
  <loc>${BASE}/stock/${escapeXml(s.symbol)}</loc>
  <image:image>
    <image:loc>${BASE}/api/og-chart?symbol=${escapeXml(s.symbol)}</image:loc>
    <image:title>${escapeXml(s.name)} 투자 지표 인포그래픽 2026</image:title>
    <image:caption>${escapeXml(s.name)}(${escapeXml(s.symbol)}) PER PBR 배당 시총 차트</image:caption>
  </image:image>
  <image:image>
    <image:loc>${BASE}/api/og?title=${encodeURIComponent(`${s.name} (${s.symbol})`)}&amp;design=2&amp;category=stock</image:loc>
    <image:title>${escapeXml(s.name)} 주식 시세 카더라</image:title>
  </image:image>
</url>`);
  }

  // ━━━ 부동산 og-chart 인포그래픽 ━━━
  const aptChartR = await (sb as any).from('apt_sites')
    .select('slug, name, region')
    .eq('is_active', true).gte('content_score', 25)
    .order('page_views', { ascending: false, nullsFirst: false })
    .limit(500);
  for (const a of (aptChartR.data || [])) {
    entries.push(`<url>
  <loc>${BASE}/apt/${escapeXml(a.slug)}</loc>
  <image:image>
    <image:loc>${BASE}/api/og-chart?apt=${escapeXml(a.slug)}</image:loc>
    <image:title>${escapeXml(a.name)} 분양가 인포그래픽</image:title>
    <image:caption>${escapeXml(a.region)} ${escapeXml(a.name)} 분양가 세대수 입지 분석</image:caption>
  </image:image>
  <image:image>
    <image:loc>${BASE}/api/og?title=${encodeURIComponent(a.name)}&amp;design=2&amp;subtitle=${encodeURIComponent(a.region)}</image:loc>
    <image:title>${escapeXml(a.name)} 분양 정보 카더라</image:title>
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


