export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

/**
 * blog-fix-existing 크론 — 기존 발행글 미흡사항 일괄 보완
 * 1회 실행 후 비활성화 (vercel.json 크론 불필요)
 * 
 * 보완 항목:
 * - cover_image NULL → OG API URL 자동 설정
 * - image_alt NULL → 제목 기반 자동 설정
 * - meta_description NULL 또는 30자 미만 → content 앞 150자 추출
 * - meta_keywords NULL → tags 기반 생성
 */

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  // 1. cover_image NULL인 발행글 수정
  const { data: noCover } = await sb.from('blog_posts')
    .select('id, title, category')
    .eq('is_published', true)
    .is('cover_image', null)
    .limit(500);

  let fixedCover = 0;
  for (const post of (noCover || [])) {
    const coverUrl = `${SITE_URL}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 60))}&category=${post.category || 'blog'}&author=${encodeURIComponent('카더라')}&design=2`;
    const imageAlt = `${post.title} — 카더라 분석`;
    await sb.from('blog_posts').update({ cover_image: coverUrl, image_alt: imageAlt }).eq('id', post.id);
    fixedCover++;
  }

  // 2. meta_description NULL 또는 30자 미만인 글 수정
  const { data: noDesc } = await sb.from('blog_posts')
    .select('id, title, content, meta_description')
    .eq('is_published', true)
    .limit(500);

  let fixedDesc = 0;
  for (const post of (noDesc || [])) {
    const desc = post.meta_description || '';
    if (desc.length < 30 && post.content) {
      // content에서 마크다운 제거 후 앞 150자 추출
      const cleanText = post.content
        .replace(/#{1,6}\s/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_~`>|]/g, '')
        .replace(/\n+/g, ' ')
        .trim();
      const newDesc = cleanText.slice(0, 148).trim() + (cleanText.length > 148 ? '...' : '');
      if (newDesc.length >= 30) {
        await sb.from('blog_posts').update({ meta_description: newDesc }).eq('id', post.id);
        fixedDesc++;
      }
    }
  }

  // 3. meta_keywords NULL인 글 수정 (tags 기반)
  const { data: noKeywords } = await sb.from('blog_posts')
    .select('id, tags, title, meta_keywords')
    .eq('is_published', true)
    .is('meta_keywords', null)
    .limit(500);

  let fixedKeywords = 0;
  for (const post of (noKeywords || [])) {
    if (post.tags && Array.isArray(post.tags) && post.tags.length > 0) {
      await sb.from('blog_posts').update({
        meta_keywords: post.tags.slice(0, 10).join(','),
      }).eq('id', post.id);
      fixedKeywords++;
    }
  }

  // 4. image_alt NULL이면서 cover_image 있는 글 수정
  const { data: noAlt } = await sb.from('blog_posts')
    .select('id, title, image_alt')
    .eq('is_published', true)
    .is('image_alt', null)
    .not('cover_image', 'is', null)
    .limit(500);

  let fixedAlt = 0;
  for (const post of (noAlt || [])) {
    await sb.from('blog_posts').update({
      image_alt: `${post.title} — 카더라 분석`,
    }).eq('id', post.id);
    fixedAlt++;
  }

  return NextResponse.json({
    fixed_cover_image: fixedCover,
    fixed_meta_description: fixedDesc,
    fixed_meta_keywords: fixedKeywords,
    fixed_image_alt: fixedAlt,
    total_fixed: fixedCover + fixedDesc + fixedKeywords + fixedAlt,
  });
}

export const GET = withCronAuth(handler);
