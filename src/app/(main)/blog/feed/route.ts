import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL , CONTACT_EMAIL} from '@/lib/constants';

export const revalidate = 3600;

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data: posts } = await sb.from('blog_posts')
    .select('slug, title, excerpt, category, published_at, created_at, author_name, tags, cover_image, image_alt')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(50);

  const items = (posts || []).map(p => {
    const dateStr = p.published_at || p.created_at || new Date().toISOString();
    const pubDate = new Date(dateStr);
    const pubDateStr = isNaN(pubDate.getTime()) ? new Date().toUTCString() : pubDate.toUTCString();
    const catLabel = p.category === 'stock' ? '주식' : p.category === 'apt' ? '부동산' : p.category === 'unsold' ? '미분양' : p.category === 'finance' ? '재테크' : '생활정보';
    const imgUrl = p.cover_image || `${SITE_URL}/api/og?title=${encodeURIComponent((p.title || '').slice(0, 60))}&design=2&category=${p.category || 'blog'}`;
    const tagItems = (p.tags || []).map((t: string) => `      <category>${t}</category>`).join('\n');
    return `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <description><![CDATA[${p.excerpt || p.title || ''}]]></description>
      <pubDate>${pubDateStr}</pubDate>
      <category>${catLabel}</category>
${tagItems}
      <author>${p.author_name || '카더라'}</author>
      <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}</guid>
      <media:content url="${imgUrl}" medium="image" width="1200" height="630">
        <media:title><![CDATA[${p.image_alt || p.title}]]></media:title>
        <media:description><![CDATA[카더라 ${catLabel} — ${p.title}]]></media:description>
      </media:content>
      <enclosure url="${imgUrl}" type="image/png" length="50000" />
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>카더라 블로그 — 주식·청약·부동산 정보</title>
    <link>${SITE_URL}/blog</link>
    <description>매일 업데이트되는 주식 시황, 청약 일정, 실거래가 분석</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <managingEditor>${CONTACT_EMAIL} (카더라)</managingEditor>
    <webMaster>${CONTACT_EMAIL} (카더라)</webMaster>
    <copyright>Copyright 2026 카더라. All rights reserved.</copyright>
    <ttl>60</ttl>
    <image>
      <url>${SITE_URL}/images/brand/kadeora-hero.png</url>
      <title>카더라 블로그</title>
      <link>${SITE_URL}/blog</link>
      <width>144</width>
      <height>144</height>
    </image>
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
