/**
 * 세션 155 — 이미지 사이트맵 인덱스 (49.71MB ISR 한도 초과 방지).
 * 단일 파일 → /sitemap-image-1.xml ~ /sitemap-image-N.xml 분할
 * 이 라우트는 sitemap index 를 반환 (Google 은 sitemapindex 로 N 페이지 인식).
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as BASE } from '@/lib/constants';

export const runtime = 'nodejs';
export const revalidate = 3600;

const URLS_PER_PAGE = 10000;

export async function GET() {
  const sb = getSupabaseAdmin();

  // 총 이미지 URL 수 추정 → 페이지 수 계산
  async function pageCount(table: string, apply: (q: any) => any, pageSize = 1000, maxPages = 50) {
    let total = 0;
    for (let i = 0; i < maxPages; i++) {
      const q = apply((sb as any).from(table).select('id', { count: 'exact', head: false }));
      const { data } = await q.range(i * pageSize, (i + 1) * pageSize - 1);
      if (!data || data.length === 0) break;
      total += data.length;
      if (data.length < pageSize) break;
    }
    return total;
  }

  const [sitesN, complexN, blogsN] = await Promise.all([
    pageCount('apt_sites', (q: any) => q.eq('is_active', true).not('images', 'is', null)),
    pageCount('apt_complex_profiles', (q: any) => q.not('images', 'is', null)),
    pageCount('blog_posts', (q: any) => q.eq('is_published', true).not('cover_image', 'is', null)),
  ]);
  const totalEntries = sitesN + complexN + blogsN;
  const pages = Math.max(1, Math.ceil(totalEntries / URLS_PER_PAGE));

  const now = new Date().toISOString();
  const items = Array.from({ length: pages }, (_, i) => i + 1)
    .map((p) => `  <sitemap>\n    <loc>${BASE}/sitemap-image-${p}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
