/**
 * Google News sitemap — 48시간 이내 최신 뉴스성 글만.
 *  s189: 이슈선점 발행글이 News 색인에 들어가도록 활성화.
 *
 *  Spec: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 *  - <publication><name>카더라</name><language>ko</language></publication>
 *  - <publication_date>YYYY-MM-DDThh:mm:ss±00:00</publication_date>
 *  - <title>...</title>
 *  - 최신순, max 1000 entries.
 */

import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { escapeXml } from '@/lib/xml-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 600;

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
`;
const FOOTER = `</urlset>`;

function emptySitemap(): string {
  return HEADER + FOOTER;
}

function respond(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=300',
    },
  });
}

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    const { data, error } = await (sb as any)
      .from('blog_posts')
      .select('slug, title, published_at, created_at, updated_at')
      .eq('is_published', true)
      .in('source_type', ['auto_issue', 'news_rss', 'upcoming', 'issue'])
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('[sitemap-news] query error:', error.message);
      return respond(emptySitemap());
    }

    const rows = data || [];
    const urls: string[] = [];
    for (const r of rows) {
      const slug = r.slug;
      const pubDate = r.published_at || r.created_at;
      if (!slug || !pubDate) continue;
      const loc = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
      urls.push([
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        '    <news:news>',
        '      <news:publication>',
        '        <news:name>카더라</news:name>',
        '        <news:language>ko</news:language>',
        '      </news:publication>',
        `      <news:publication_date>${escapeXml(new Date(pubDate).toISOString())}</news:publication_date>`,
        `      <news:title>${escapeXml(r.title || '')}</news:title>`,
        '    </news:news>',
        '  </url>',
      ].join('\n'));
    }

    const xml = HEADER + urls.join('\n') + (urls.length ? '\n' : '') + FOOTER;
    return respond(xml);
  } catch (e: any) {
    console.error('[sitemap-news] fatal:', e?.message);
    return respond(emptySitemap());
  }
}
