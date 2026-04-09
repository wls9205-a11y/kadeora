export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * 블로그 내부링크 자동 연결 크론 v2
 * - region + source_ref + 태그 + 키워드 매칭 (관련성 높은 매칭만)
 * - 배치 2,000건/실행, 매일 04:00
 * - general 카테고리 3개 제한
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-internal-links', async () => {
    const sb = getSupabaseAdmin();
    const BATCH = 500;

    // 먼저 related_slugs가 없는 글만 카운트 (빠른 체크)
    const { count: pendingCount } = await sb.from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .is('related_slugs', null);

    if (!pendingCount || pendingCount === 0) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'all_linked' } };
    }

    // 처리할 대상만 로드
    const { data: targets } = await sb.from('blog_posts')
      .select('id, slug, category, tags, title, source_ref')
      .eq('is_published', true)
      .is('related_slugs', null)
      .order('view_count', { ascending: false })
      .limit(BATCH);

    if (!targets?.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'all_linked' } };

    // 매칭용 인덱스: 같은 카테고리 글 로드
    const categories = [...new Set(targets.map((t: any) => t.category))];
    const { data: allPosts } = await sb.from('blog_posts')
      .select('id, slug, category, tags, title, source_ref')
      .eq('is_published', true)
      .in('category', categories)
      .order('view_count', { ascending: false })
      .limit(2000);

    // 카테고리별 게시글 인덱스 (성능 최적화)
    const catIndex: Record<string, any[]> = {};
    for (const p of (allPosts || [])) {
      if (!catIndex[p.category]) catIndex[p.category] = [];
      catIndex[p.category].push(p);
    }

    let updated = 0;
    const MAX_LINKS_GENERAL = 3;
    const MAX_LINKS = 5;

    for (const post of targets) {
      try {
        const candidates = catIndex[post.category]?.filter((c: any) => c.slug !== post.slug) || [];
        if (!candidates.length) continue;

        const postTags: string[] = (post.tags as string[]) || [];
        const titleWords = extractKeywords(post.title);
        const postRegion = extractRegion(post.slug);
        const isGeneral = post.category === 'general';
        const maxLinks = isGeneral ? MAX_LINKS_GENERAL : MAX_LINKS;

        const scored = candidates.map((c: any) => {
          const cTags: string[] = (c.tags as string[]) || [];
          const commonTags = postTags.filter(t => cTags.includes(t)).length;
          const cWords = extractKeywords(c.title);
          const commonWords = titleWords.filter(w => cWords.includes(w)).length;
          // source_ref 매칭 (같은 원본 데이터 기반이면 매우 관련 높음)
          const sameSource = post.source_ref && c.source_ref && post.source_ref === c.source_ref ? 5 : 0;
          // region 매칭 (같은 지역이면 관련 높음)
          const cRegion = extractRegion(c.slug);
          const sameRegion = postRegion && cRegion && postRegion === cRegion ? 3 : 0;
          return { slug: c.slug as string, score: commonTags * 3 + commonWords * 2 + sameSource + sameRegion };
        })
        .filter(s => s.score > 0)  // 관련성 0인 것은 제외
        .sort((a, b) => b.score - a.score)
        .slice(0, maxLinks);

        if (!scored.length) {
          // 관련성 매칭 실패 시 같은 카테고리 인기글 3개로 폴백
          const fallback = candidates
            .sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0))
            .slice(0, 3)
            .map((c: any) => c.slug);
          if (fallback.length) {
            await (sb as any).from('blog_posts').update({ related_slugs: fallback }).eq('id', post.id);
            updated++;
          }
          continue;
        }

        const slugs = scored.map(s => s.slug);
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
  const stop = new Set(['의','에','를','을','이','가','은','는','와','과','로','으로','에서','까지','부터','대한','위한','통한','관한','및','또는','그리고','하지만','그러나','어떻게','왜','어디','무엇','분석','정리','비교','추천','가이드','방법','전략','전망','현황','요약','정보','안내','소개','vs','top','best','2026','2025']);
  return title.replace(/[^\w가-힣\s]/g, '').split(/\s+/).filter(w => w.length >= 2 && !stop.has(w.toLowerCase())).map(w => w.toLowerCase());
}

function extractRegion(slug: string): string | null {
  const regions = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주',
    'seoul','busan','daegu','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi','gangwon'];
  for (const r of regions) {
    if (slug.includes(r)) return r;
  }
  return null;
}
