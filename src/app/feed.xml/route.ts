import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 1800; // 30분마다 갱신

import { SITE_URL as SITE } from '@/lib/constants';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const CATEGORY_MAP: Record<string, string> = {
  stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크',
  local: '우리동네', free: '자유', general: '정보',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category'); // ?category=stock

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // 블로그 500개 + 커뮤니티 200개
  let blogQuery = supabase
    .from('blog_posts')
    .select('slug, title, excerpt, category, tags, published_at, updated_at')
    .eq('is_published', true)
    .not('published_at', 'is', null)
    .lte('published_at', now)
    .order('published_at', { ascending: false })
    .limit(500);

  let postQuery = supabase
    .from('posts')
    .select('id, title, content, category, created_at, slug')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(200);

  // 카테고리 필터
  if (category) {
    blogQuery = blogQuery.eq('category', category);
    postQuery = postQuery.eq('category', category);
  }

  const [blogsR, postsR] = await Promise.all([blogQuery, postQuery]);

  const blogItems = (blogsR.data || []).map((b: any) => ({
    title: b.title,
    link: `${SITE}/blog/${b.slug}`,
    description: b.excerpt || b.title,
    pubDate: new Date(b.published_at || b.updated_at).toUTCString(),
    category: CATEGORY_MAP[b.category] || '정보',
    tags: b.tags || [],
    guid: `${SITE}/blog/${b.slug}`,
  }));

  const postItems = (postsR.data || []).map((p: any) => ({
    title: p.title || '카더라 게시글',
    link: p.slug ? `${SITE}/feed/${p.slug}` : `${SITE}/feed/${p.id}`,
    description: (p.content || '').replace(/[#*\[\]]/g, '').slice(0, 300),
    pubDate: new Date(p.created_at).toUTCString(),
    category: CATEGORY_MAP[p.category] || '자유',
    tags: [],
    guid: p.slug ? `${SITE}/feed/${p.slug}` : `${SITE}/feed/${p.id}`,
  }));

  const allItems = [...blogItems, ...postItems].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  const channelTitle = category
    ? `카더라 ${CATEGORY_MAP[category] || category} 피드`
    : '카더라 — 대한민국 소리소문 정보 커뮤니티';

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${SITE}</link>
    <description>주식 시세, 아파트 청약, 부동산 실거래가, 재테크 정보를 매일 업데이트합니다.</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>카더라 RSS Generator</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <atom:link href="${SITE}/feed.xml${category ? `?category=${category}` : ''}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE}/icons/icon-192.png</url>
      <title>카더라</title>
      <link>${SITE}</link>
    </image>
${allItems.map(item => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <category>${escapeXml(item.category)}</category>
      <guid isPermaLink="true">${item.guid}</guid>
      <dc:creator>카더라</dc:creator>${item.tags.length ? `\n      ${item.tags.map((t: string) => `<category>${escapeXml(t)}</category>`).join('\n      ')}` : ''}
    </item>`).join('\n')}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  });
}
