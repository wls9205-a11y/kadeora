import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 300; // 5분 캐시
export const dynamic = 'force-dynamic'; // s168: 빌드타임 DB 호출 제거

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
  const sb = getSupabaseAdmin();

  // 최근 48시간 이내 자동발행 기사만 (Google News Sitemap 정책)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await sb.from('blog_posts')
    .select('slug, title, published_at, tags, category, cover_image, image_alt')
    .eq('is_published', true)
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(100);

  const items = (posts || []).map((p: any) => {
    const pubDate = p.published_at ? new Date(p.published_at).toISOString() : new Date().toISOString();
    const tags = (p.tags || []).slice(0, 5).join(', ');
    // cover_image가 상대 경로(/api/og?... 등)일 때 절대 URL로 보정 — 구글 이미지 크롤러 호환
    const rawImg = p.cover_image || `${SITE_URL}/api/og?title=${encodeURIComponent((p.title || '').slice(0, 60))}&category=${p.category || 'blog'}&design=2`;
    const imgUrl = rawImg.startsWith('/') ? `${SITE_URL}${rawImg}` : rawImg;
    const imgAlt = escXml(p.image_alt || p.title || '카더라');

    return `  <url>
    <loc>${SITE_URL}/blog/${escXml(p.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>카더라</news:name>
        <news:language>ko</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escXml(p.title)}</news:title>
      ${tags ? `<news:keywords>${escXml(tags)}</news:keywords>` : ''}
    </news:news>
    <image:image>
      <image:loc>${escXml(imgUrl)}</image:loc>
      <image:title>${escXml(p.title)}</image:title>
      <image:caption>${imgAlt}</image:caption>
    </image:image>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${items.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
