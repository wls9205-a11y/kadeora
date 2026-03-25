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

  const [blogsR, postsR, sitesR, discussR] = await Promise.all([blogQuery, postQuery,
    supabase.from('apt_sites').select('slug, name, description, region, sigungu, builder, site_type, total_units, updated_at, created_at')
      .eq('is_active', true).gte('content_score', 25).order('updated_at', { ascending: false }).limit(200),
    supabase.from('discussion_topics').select('id, title, description, category, option_a, option_b, vote_a, vote_b, comment_count, created_at')
      .order('created_at', { ascending: false }).limit(100),
  ]);

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

  const aptSiteItems = (sitesR.data || []).map((s: any) => {
    const typeLabel: Record<string, string> = { subscription: '분양 정보', redevelopment: '재개발 현황', trade: '실거래가·시세', unsold: '미분양 현황', landmark: '시세·분석' };
    const typeCat: Record<string, string> = { subscription: '분양', redevelopment: '재개발', trade: '실거래', unsold: '미분양', landmark: '시세' };
    return {
      title: `${s.name} ${typeLabel[s.site_type] || '부동산 정보'} — ${s.region} ${s.sigungu || ''}`,
      link: `${SITE}/apt/${s.slug}`,
      description: s.description || `${s.region} ${s.sigungu || ''} ${s.name}. ${s.builder ? `${s.builder} 시공.` : ''} ${s.total_units ? `총 ${s.total_units}세대.` : ''} 청약 일정, 분양가, 실거래가 정보를 카더라에서 확인하세요.`,
      pubDate: new Date(s.updated_at || s.created_at).toUTCString(),
      category: typeCat[s.site_type] || '부동산',
      tags: [s.name, s.region, typeCat[s.site_type] || '부동산', s.builder].filter(Boolean),
      guid: `${SITE}/apt/${s.slug}`,
    };
  });

  const discussItems = (discussR.data || []).map((d: any) => {
    const total = (d.vote_a || 0) + (d.vote_b || 0);
    const catLabel = CATEGORY_MAP[d.category] || '토론';
    return {
      title: `[${catLabel} 토론] ${d.title}`,
      link: `${SITE}/discuss/${d.id}`,
      description: d.description || `${d.option_a} vs ${d.option_b} — ${total}명 투표, ${d.comment_count || 0}개 의견`,
      pubDate: new Date(d.created_at).toUTCString(),
      category: catLabel,
      tags: [catLabel, '토론', d.option_a, d.option_b].filter(Boolean),
      guid: `${SITE}/discuss/${d.id}`,
    };
  });

  const allItems = [...blogItems, ...postItems, ...aptSiteItems, ...discussItems].sort(
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
