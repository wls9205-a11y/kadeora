export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * 블로그 내부링크 자동 연결 크론
 * - AI 비용 0원 — 태그/카테고리/제목 키워드 매칭
 * - related_slugs 없는 게시글 대상, 배치 100건씩
 * - 주 1회 실행 (일요일 03:00)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-internal-links', async () => {
    const sb = getSupabaseAdmin();

    // related_slugs 없는 게시글 — 일반 select 후 JS 필터
    const { data: allPosts } = await sb.from('blog_posts')
      .select('id, slug, category, tags, title')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!allPosts?.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_posts' } };
    }

    // JS에서 related_slugs 없는 것만 필터 (타입 우회)
    const targets = allPosts.filter((p: any) => {
      const rs = (p as any).related_slugs;
      return !rs || (Array.isArray(rs) && rs.length === 0);
    }).slice(0, 100);

    if (!targets.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'all_linked' } };
    }

    let updated = 0;

    for (const post of targets) {
      try {
        const postTags: string[] = (post.tags as string[]) || [];

        const { data: candidates } = await sb.from('blog_posts')
          .select('slug, tags, title')
          .eq('is_published', true)
          .eq('category', post.category)
          .neq('slug', post.slug)
          .limit(50);

        if (!candidates?.length) continue;

        const titleWords = extractKeywords(post.title);
        const scored = candidates.map((c: any) => {
          const cTags: string[] = (c.tags as string[]) || [];
          const commonTags = postTags.filter(t => cTags.includes(t)).length;
          const cWords = extractKeywords(c.title);
          const commonWords = titleWords.filter(w => cWords.includes(w)).length;
          return { slug: c.slug as string, score: commonTags * 3 + commonWords };
        })
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

        if (!scored.length) continue;

        const slugs = scored.map(s => s.slug);
        // 타입 없는 컬럼 업데이트 — admin client raw update
        const { error } = await (sb as any).from('blog_posts')
          .update({ related_slugs: slugs })
          .eq('id', post.id);

        if (!error) updated++;
      } catch { continue; }
    }

    return { processed: targets.length, created: updated, failed: targets.length - updated };
  });

  if (!result.success) return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}

function extractKeywords(title: string): string[] {
  const stop = new Set(['의','에','를','을','이','가','은','는','와','과','로','으로','에서','까지','부터','대한','위한','통한','관한','및','또는','그리고','하지만','그러나','어떻게','왜','어디','무엇','분석','정리','비교','추천','가이드','방법','전략','vs','top','best']);
  return title.replace(/[^\w가-힣\s]/g, '').split(/\s+/).filter(w => w.length >= 2 && !stop.has(w.toLowerCase())).map(w => w.toLowerCase());
}
