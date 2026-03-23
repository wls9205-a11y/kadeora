import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const revalidate = 3600;

import { SITE_URL as SITE } from '@/lib/constants';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  const now = new Date().toISOString();

  // 최신 블로그 50개 + 최신 커뮤니티 글 20개
  const [blogsR, postsR] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('slug, title, excerpt, category, published_at, updated_at')
      .eq('is_published', true)
      .not('published_at', 'is', null)
      .lte('published_at', now)
      .order('published_at', { ascending: false })
      .limit(50),
    supabase
      .from('posts')
      .select('id, title, content, category, created_at, slug')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const blogItems = (blogsR.data || []).map((b: any) => ({
    title: b.title,
    link: `${SITE}/blog/${b.slug}`,
    description: b.excerpt || b.title,
    pubDate: new Date(b.published_at || b.updated_at).toUTCString(),
    category: b.category === 'stock' ? '주식' : b.category === 'apt' ? '부동산' : b.category === 'unsold' ? '미분양' : b.category === 'finance' ? '재테크' : '정보',
  }));

  const postItems = (postsR.data || []).map((p: any) => ({
    title: p.title || '카더라 게시글',
    link: p.slug ? `${SITE}/feed/${p.slug}` : `${SITE}/feed/${p.id}`,
    description: (p.content || '').slice(0, 200),
    pubDate: new Date(p.created_at).toUTCString(),
    category: p.category === 'stock' ? '주식' : p.category === 'apt' ? '부동산' : p.category === 'local' ? '우리동네' : '자유',
  }));

  const allItems = [...blogItems, ...postItems].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>카더라 — 대한민국 소리소문 정보 커뮤니티</title>
    <link>${SITE}</link>
    <description>주식 시세, 아파트 청약, 부동산 실거래가, 재테크 정보를 매일 업데이트합니다.</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE}/logo.svg</url>
      <title>카더라</title>
      <link>${SITE}</link>
    </image>
${allItems
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <category>${escapeXml(item.category)}</category>
      <guid isPermaLink="true">${item.link}</guid>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
