import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SITE = 'https://kadeora.app';

export const revalidate = 3600;

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data: posts } = await sb.from('blog_posts')
    .select('slug, title, content, category, published_at, meta_description')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(50);

  const items = (posts || []).map(p => `<item>
  <title><![CDATA[${p.title}]]></title>
  <link>${SITE}/blog/${p.slug}</link>
  <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
  <pubDate>${new Date(p.published_at || new Date()).toUTCString()}</pubDate>
  <description><![CDATA[${(p.meta_description || p.content || '').slice(0, 200)}]]></description>
  <category>${p.category || 'general'}</category>
</item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>카더라 — 주식 · 부동산 · 재테크</title>
  <link>${SITE}</link>
  <description>주식 시세, 부동산 청약, 재테크 정보를 공유하는 투자 커뮤니티</description>
  <language>ko</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
  ${items}
</channel>
</rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } });
}
