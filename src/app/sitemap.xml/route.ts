import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const revalidate = 3600;
export const dynamic = 'force-dynamic'; // s168: 빌드타임 DB 호출 제거

// 정적 ID 구성:
// 0   = static + regions + sectors + themes + calc + daily index
// 1   = stock_quotes
// 2   = apt_sites (미분양/재개발/청약/실거래 포함 — unsold_apts는 여기로 308 리다이렉트되므로 별도 없음)
// 3   = feed posts (시드 제외)
// 4   = discuss
// 5~7 = apt_complex_profiles (12000/chunk)
// 8+  = blog_posts (5000/chunk, 동적으로 계산)
// 12  = stock vs stock 비교
// 13  = stock_glossary (용어사전)
// 14  = daily_reports archive (지역별 일일 리포트 히스토리)
// 15  = /stock/[symbol]/chart (종목별 차트 페이지)
// 16  = /stock/[symbol]/financials (종목별 재무 페이지)
// 21  = area hubs (시군구, 동, 빌더, apt 비교)
// 30  = calc_topic_clusters (계산기 토픽 허브 50개)
// 31  = calc_results popular (조회수 5+ 인기 결과 영구 URL)
const FIXED_IDS_PRE_BLOG = [0, 1, 2, 3, 4, 5, 6, 7];
const FIXED_IDS_POST_BLOG = [12, 13, 14, 15, 16, 21, 30, 31];
const BLOG_PER_SITEMAP = 5000;

export async function GET() {
  const now = new Date().toISOString();

  // 블로그 청크 수 동적 계산 — 빈 사이트맵 생성 방지 (크롤 예산 절약)
  let blogChunks = 1;
  try {
    const sb = getSupabaseAdmin();
    const { count } = await sb.from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)
      .not('published_at', 'is', null);
    blogChunks = Math.max(1, Math.ceil((count || 0) / BLOG_PER_SITEMAP));
  } catch {
    // DB 장애 시 보수적으로 4청크 (최대 20,000 커버)
    blogChunks = 4;
  }
  const BLOG_IDS = Array.from({ length: blogChunks }, (_, i) => 8 + i);
  const ALL_IDS = [...FIXED_IDS_PRE_BLOG, ...BLOG_IDS, ...FIXED_IDS_POST_BLOG];

  const subSitemaps = ALL_IDS.map(id => `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${subSitemaps}
  <sitemap>
    <loc>${SITE_URL}/image-sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/news-sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
