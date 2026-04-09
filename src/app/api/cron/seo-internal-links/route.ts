import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * seo-internal-links — 클러스터 내부 링크 자동 보강
 * 
 * 검색유입이 오는 블로그 글에 관련 콘텐츠 내부 링크를 자동 삽입
 * Google이 토픽 클러스터를 인식하도록 구조화
 */
async function handler() {
  const sb = getSupabaseAdmin();
  let linked = 0;

  // 1. 내부 링크가 없는 인기 글 (조회 50+, 링크 0개)
  const { data: posts } = await sb
    .from('blog_posts')
    .select('id, slug, title, category, content')
    .eq('is_published', true)
    .gte('view_count', 50)
    .limit(50);

  if (!posts?.length) return { linked: 0 };

  for (const post of posts) {
    // 이미 내부 링크 있으면 스킵
    if (post.content?.includes('href="/blog/') || post.content?.includes('href="/apt/')) continue;

    // 같은 카테고리의 관련 글 3개 찾기
    const { data: related } = await sb
      .from('blog_posts')
      .select('slug, title')
      .eq('is_published', true)
      .eq('category', post.category)
      .neq('id', post.id)
      .gte('view_count', 10)
      .order('view_count', { ascending: false })
      .limit(3);

    if (!related?.length) continue;

    // 본문 끝에 "관련 분석" 섹션 추가
    const linkSection = `\n\n## 📊 관련 분석\n\n${related.map((r: any) => 
      `- [${r.title}](/blog/${r.slug})`
    ).join('\n')}\n`;

    const { error } = await sb
      .from('blog_posts')
      .update({ content: post.content + linkSection })
      .eq('id', post.id);

    if (!error) linked++;
  }

  return { checked: posts.length, linked };
}

export const GET = withCronLogging('seo-internal-links', handler);
export const maxDuration = 60;
