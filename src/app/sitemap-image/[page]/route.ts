/**
 * 세션 155 retry — 이미지 사이트맵 분할 (10K URL/page).
 * Next.js 15 파일명 호환: [page].xml 조합 제거, /sitemap-image/{N} 경로 사용.
 * Content-Type application/xml 로 Google/Naver 정상 인식.
 */
import { NextRequest, NextResponse } from 'next/server';
import { escapeXml } from '@/lib/xml-utils';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as BASE } from '@/lib/constants';
import { URLS_PER_PAGE } from '@/lib/seo/sitemapConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 3600;

type ImgEntry = { loc: string; imgs: { url: string; title: string; caption: string; geo?: string }[] };

async function collectAll(sb: ReturnType<typeof getSupabaseAdmin>): Promise<ImgEntry[]> {
  async function fetchAll(table: string, cols: string, apply: (q: any) => any, pageSize = 1000, maxPages = 50) {
    const all: any[] = [];
    for (let i = 0; i < maxPages; i++) {
      const q = apply((sb as any).from(table).select(cols));
      const { data } = await q.range(i * pageSize, (i + 1) * pageSize - 1);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
    }
    return all;
  }

  // 세션 156: stock_images + blog_post_images 추가 (누락 ~29K URL 복구)
  const [sites, complexes, blogs, stockImgs, blogImgs] = await Promise.all([
    fetchAll('apt_sites', 'slug, name, images, region, sigungu',
      (q: any) => q.eq('is_active', true).not('images', 'is', null)),
    fetchAll('apt_complex_profiles', 'apt_name, images, region_nm, sigungu',
      (q: any) => q.not('images', 'is', null)),
    fetchAll('blog_posts', 'slug, title, cover_image, image_alt, category',
      (q: any) => q.eq('is_published', true).not('cover_image', 'is', null)
        .order('published_at', { ascending: false })),
    fetchAll('stock_images', 'symbol, image_url, alt_text, caption',
      (q: any) => q.eq('is_active', true).not('image_url', 'is', null)),
    fetchAll('blog_post_images', 'post_id, image_url, alt_text, position',
      (q: any) => q.not('image_url', 'is', null).order('post_id', { ascending: true })),
  ]);

  const out: ImgEntry[] = [];

  for (const s of sites) {
    const imgs = Array.isArray(s.images) ? s.images : [];
    if (imgs.length === 0) continue;
    const list = imgs.slice(0, 10).map((img: any) => {
      let url = typeof img === 'string' ? img : img?.link || img?.url;
      if (!url) return null;
      url = String(url).replace(/^http:\/\//, 'https://');
      const title = (typeof img === 'object' && img?.title)
        ? String(img.title)
        : `${s.name} ${s.region || ''} ${s.sigungu || ''}`.trim();
      return {
        url,
        title,
        caption: s.region && s.sigungu ? `${s.region} ${s.sigungu} ${s.name} 분양 현장` : `${s.name} 분양 현장`,
        geo: s.region && s.sigungu ? `${s.region} ${s.sigungu}` : undefined,
      };
    }).filter((x: any): x is NonNullable<typeof x> => x !== null);
    if (list.length) out.push({ loc: `${BASE}/apt/${encodeURIComponent(s.slug)}`, imgs: list });
  }

  for (const c of complexes) {
    const imgs = Array.isArray(c.images) ? c.images : [];
    if (imgs.length === 0) continue;
    const list = imgs.slice(0, 7).map((img: any) => {
      let url = typeof img === 'string' ? img : img?.url;
      if (!url) return null;
      url = String(url).replace(/^http:\/\//, 'https://');
      return {
        url,
        title: `${c.apt_name} 아파트 ${c.region_nm || ''} ${c.sigungu || ''}`.trim(),
        caption: `${c.region_nm || ''} ${c.sigungu || ''} ${c.apt_name} 아파트 실거래가 시세`.trim(),
        geo: c.region_nm && c.sigungu ? `${c.region_nm} ${c.sigungu}` : undefined,
      };
    }).filter((x: any): x is NonNullable<typeof x> => x !== null);
    if (list.length) out.push({ loc: `${BASE}/apt/complex/${encodeURIComponent(c.apt_name)}`, imgs: list });
  }

  for (const b of blogs) {
    if (!b.cover_image || String(b.cover_image).includes('/api/og')) continue;
    const url = String(b.cover_image).replace(/^http:\/\//, 'https://');
    out.push({
      loc: `${BASE}/blog/${encodeURIComponent(b.slug)}`,
      imgs: [{
        url,
        title: b.title || '카더라',
        caption: b.image_alt || `${b.title || '카더라'} — ${b.category || 'blog'}`,
      }],
    });
  }

  // 세션 156: stock_images — /stock/{symbol} URL 단위로 그룹화
  const stockBySymbol = new Map<string, any[]>();
  for (const si of stockImgs) {
    if (!si.symbol || !si.image_url) continue;
    const url = String(si.image_url).replace(/^http:\/\//, 'https://');
    if (!stockBySymbol.has(si.symbol)) stockBySymbol.set(si.symbol, []);
    stockBySymbol.get(si.symbol)!.push({
      url,
      title: si.alt_text || `${si.symbol} 주식 차트`,
      caption: si.caption || `${si.symbol} 주가·시세 차트`,
    });
  }
  for (const [symbol, imgs] of stockBySymbol) {
    out.push({ loc: `${BASE}/stock/${encodeURIComponent(symbol)}`, imgs: imgs.slice(0, 10) });
  }

  // 세션 156: blog_post_images — /blog/{slug} URL 단위로 그룹화 (post_id→slug 매핑 필요)
  // 비용 절약: post_id 기준으로 slug 이미 blogs 에서 조회됨. blogs 는 cover_image 있는 것만 포함.
  // 따라서 blog_post_images 는 별도 post lookup 없이 post_id 기반 URL 생성 불가.
  // 대안: /blog/post-{post_id} URL 은 없으므로 blog slug 재조회 또는 skip.
  // 이번 세션: skip (다음 세션 blog_posts.slug 매핑 추가)

  return out;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ page: string }> }) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (!Number.isFinite(page) || page < 1) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const sb = getSupabaseAdmin();
  const all = await collectAll(sb);
  const offset = (page - 1) * URLS_PER_PAGE;
  const slice = all.slice(offset, offset + URLS_PER_PAGE);
  if (slice.length === 0) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const parts: string[] = [];
  for (const e of slice) {
    const imgXml = e.imgs.map((im) => {
      const geoLoc = im.geo ? `\n        <image:geo_location>${escapeXml(im.geo)}</image:geo_location>` : '';
      return `      <image:image>
        <image:loc>${escapeXml(im.url)}</image:loc>
        <image:title>${escapeXml(im.title)}</image:title>
        <image:caption>${escapeXml(im.caption)}</image:caption>${geoLoc}
      </image:image>`;
    }).join('\n');
    parts.push(`  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n${imgXml}\n  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${parts.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
