export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

const BATCH = 200;

/**
 * 블로그 품질 자동 평가 크론
 * - 비공개 글 중 quality_checked_at이 NULL이거나 30일 경과한 글 대상
 * - 100점 만점 quality_score 산출
 * - auto_publish_eligible 자동 설정
 * 매시간 200건 처리 → 51K 전체 ~11일
 */

interface QualityDetails {
  length: number;
  structure: number;
  links: number;
  meta: number;
  image: number;
  uniqueness: number;
  freshness: number;
}

function scorePost(post: any): { score: number; details: QualityDetails; eligible: boolean } {
  const content: string = post.content || '';
  const contentLen: number = post.content_length || content.length;

  // 1. 콘텐츠 길이 (25점)
  let length = 0;
  if (contentLen >= 4000) length = 25;
  else if (contentLen >= 3000) length = 20;
  else if (contentLen >= 2500) length = 15;
  else if (contentLen >= 2000) length = 10;
  else if (contentLen >= 1000) length = 5;

  // 2. 구조화 (20점) — H2, H3, 리스트, 테이블
  let structure = 0;
  const h2Count = (content.match(/<h2/gi) || []).length;
  const h3Count = (content.match(/<h3/gi) || []).length;
  const hasList = /<[uo]l/i.test(content);
  const hasTable = /<table/i.test(content);
  if (h2Count >= 3) structure += 10; else if (h2Count >= 2) structure += 7; else if (h2Count >= 1) structure += 4;
  if (h3Count >= 1) structure += 5;
  if (hasList || hasTable) structure += 5;

  // 3. 내부링크 (15점)
  let links = 0;
  const relatedSlugs = post.related_slugs || [];
  if (relatedSlugs.length >= 3) links += 10; else if (relatedSlugs.length >= 1) links += 5;
  const internalLinks = (content.match(/href="\/(?!api)/gi) || []).length;
  if (internalLinks >= 2) links += 5; else if (internalLinks >= 1) links += 3;

  // 4. 메타데이터 (15점)
  let meta = 0;
  const titleLen = (post.title || '').length;
  if (titleLen >= 20 && titleLen <= 55) meta += 5; else if (titleLen >= 15 && titleLen <= 60) meta += 3;
  const descLen = (post.meta_description || '').length;
  if (descLen >= 50 && descLen <= 150) meta += 5; else if (descLen >= 30) meta += 3;
  if (post.excerpt && post.excerpt.length > 20) meta += 5;

  // 5. 이미지 (10점)
  let image = 0;
  const coverImage = post.cover_image || '';
  if (coverImage && !coverImage.includes('/api/og')) image += 5; else if (coverImage) image += 2;
  if (post.image_alt && post.image_alt.length > 5) image += 5;

  // 6. 고유성 (10점) — AI 패턴 비율
  let uniqueness = 0;
  const hasFaq = /<(div|section)[^>]*class[^>]*faq/i.test(content) || /자주 묻는 질문|FAQ/i.test(content);
  const hasDisclaimer = /면책|disclaimer|투자.*책임|개인.*의견/i.test(content);
  if (!hasFaq) uniqueness += 5; else uniqueness += 2;
  if (!hasDisclaimer) uniqueness += 5; else uniqueness += 2;

  // 7. 데이터 신선도 (5점)
  let freshness = 0;
  if (post.data_date) {
    const daysDiff = Math.floor((Date.now() - new Date(post.data_date).getTime()) / 86400000);
    if (daysDiff <= 30) freshness = 5;
    else if (daysDiff <= 90) freshness = 3;
    else if (daysDiff <= 365) freshness = 1;
  }

  const details: QualityDetails = { length, structure, links, meta, image, uniqueness, freshness };
  const score = length + structure + links + meta + image + uniqueness + freshness;

  // 자동 공개 자격: score >= 65 AND seo_tier S/A/restore_candidate AND content >= 2500자
  const eligibleTiers = ['S', 'A', 'restore_candidate'];
  const eligible = score >= 65 && eligibleTiers.includes(post.seo_tier || '') && contentLen >= 2500;

  return { score, details, eligible };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-quality-score', async () => {
    const sb = getSupabaseAdmin();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // 평가 대상: 비공개 + (미평가 OR 30일 경과)
    const { data: posts, error } = await sb
      .from('blog_posts')
      .select('id, title, content, content_length, excerpt, meta_description, cover_image, image_alt, category, tags, related_slugs, seo_tier, seo_score, data_date, rewritten_at')
      .eq('is_published', false)
      .or(`quality_checked_at.is.null,quality_checked_at.lt.${thirtyDaysAgo}`)
      .order('quality_checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH);

    if (error) throw new Error(`query error: ${error.message}`);
    if (!posts?.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_targets' } };

    let updated = 0;
    let eligible = 0;
    let failed = 0;
    const scoreDist: Record<string, number> = { 'S(80+)': 0, 'A(65-79)': 0, 'B(40-64)': 0, 'C(<40)': 0 };

    for (const post of posts) {
      try {
        const { score, details, eligible: isEligible } = scorePost(post);

        await sb.from('blog_posts').update({
          quality_score: score,
          quality_details: details,
          quality_checked_at: new Date().toISOString(),
          auto_publish_eligible: isEligible,
          content_length: post.content_length || (post.content || '').length,
        }).eq('id', post.id);

        updated++;
        if (isEligible) eligible++;
        if (score >= 80) scoreDist['S(80+)']++;
        else if (score >= 65) scoreDist['A(65-79)']++;
        else if (score >= 40) scoreDist['B(40-64)']++;
        else scoreDist['C(<40)']++;
      } catch {
        failed++;
      }
    }

    return {
      processed: posts.length,
      created: eligible,
      updated,
      failed,
      metadata: { eligible_count: eligible, score_distribution: scoreDist },
    };
  });

  return NextResponse.json(result);
}
