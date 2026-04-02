export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * 블로그 내부링크 자동 연결 크론
 * - AI 비용 0원 — 태그/카테고리/제목 키워드 매칭
 * - related_slugs 없는 게시글 대상, 배치 100건씩
 * - 같은 카테고리 + 공통 태그 수로 관련도 점수 산정
 * - 주 1회 실행 (일요일 03:00)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-internal-links', async () => {
    const supabase = getSupabaseAdmin();

    // related_slugs가 비어있는 게시글 100건 (타입 우회 — DB에만 존재하는 컬럼)
    const { data: targets } = await (supabase.from('blog_posts')
      .select('id, slug, category, tags, title')
      .eq('is_published', true)
      .or('related_slugs.is.null,related_slugs.eq.{}')
      .order('created_at', { ascending: false })
      .limit(100) as any);

    if (!targets?.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_targets' } };
    }

    let updated = 0;

    for (const post of targets) {
      try {
        const postTags: string[] = (post.tags as string[]) || [];

        // 같은 카테고리의 다른 글들 중 태그 겹침이 많은 순서
        let query = supabase.from('blog_posts')
          .select('slug, tags, title')
          .eq('is_published', true)
          .eq('category', post.category)
          .neq('slug', post.slug)
          .limit(50);

        const { data: candidates } = await query;
        if (!candidates?.length) continue;

        // 관련도 점수 계산: 공통 태그 수 + 제목 키워드 겹침
        const titleWords = extractKeywords(post.title);

        const scored = candidates.map((c: any) => {
          const cTags: string[] = (c.tags as string[]) || [];
          const commonTags = postTags.filter(t => cTags.includes(t)).length;
          const cTitleWords = extractKeywords(c.title);
          const commonWords = titleWords.filter(w => cTitleWords.includes(w)).length;
          return { slug: c.slug, score: commonTags * 3 + commonWords };
        })
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

        if (scored.length === 0) continue;

        const relatedSlugs = scored.map(s => s.slug);

        const { error } = await (supabase.from('blog_posts')
          .update({ related_slugs: relatedSlugs } as any)
          .eq('id', post.id) as any);

        if (!error) updated++;
      } catch { continue; }
    }

    return { processed: targets.length, created: updated, failed: targets.length - updated };
  });

  if (!result.success) return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}

/**
 * 제목에서 의미 있는 키워드 추출 (불용어 제거)
 */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    '의', '에', '를', '을', '이', '가', '은', '는', '와', '과', '로', '으로',
    '에서', '까지', '부터', '대한', '위한', '통한', '관한', '및', '또는',
    '그리고', '하지만', '그러나', '어떻게', '왜', '어디', '무엇',
    '분석', '정리', '비교', '추천', '가이드', '방법', '전략',
    'vs', 'top', 'best',
  ]);

  return title
    .replace(/[^\w가-힣\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w.toLowerCase()))
    .map(w => w.toLowerCase());
}
