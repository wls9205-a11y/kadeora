import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 3600;

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data: posts } = await sb.from('blog_posts')
    .select('slug, title, excerpt, category, published_at, created_at, author_name, tags')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(50);

  const items = (posts || []).map(p => {
    const dateStr = p.published_at || p.created_at || new Date().toISOString();
    return `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <description><![CDATA[${p.excerpt || ''}]]></description>
      <pubDate>${new Date(dateStr).toUTCString()}</pubDate>
      <category>${p.category}</category>
      <author>${p.author_name || '카더라 데이터팀'}</author>
      <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}</guid>
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>카더라 블로그 — 주식·청약·부동산 정보</title>
    <link>${SITE_URL}/blog</link>
    <description>매일 업데이트되는 주식 시황, 청약 일정, 실거래가 분석</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/feed" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
