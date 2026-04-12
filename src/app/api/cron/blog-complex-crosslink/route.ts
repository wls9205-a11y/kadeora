import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

/**
 * 블로그 ↔ 단지백과 크로스링크 크론
 * 매주 수요일 05:00 실행
 * blog_posts.content에서 단지명 언급 → apt_complex_profiles.blog_post_count 업데이트
 */
export async function GET() {
  const result = await withCronLogging('blog-complex-crosslink', async () => {
    const sb = getSupabaseAdmin();

    // 1) 거래 활발한 상위 500개 단지명 가져오기
    const { data: topComplexes } = await (sb as any).from('apt_complex_profiles')
      .select('apt_name')
      .not('age_group', 'is', null)
      .gt('sale_count_1y', 5)
      .order('sale_count_1y', { ascending: false })
      .limit(500);

    if (!topComplexes?.length) return { processed: 0 };

    // 2) apt 카테고리 블로그 제목에서 단지명 매칭
    const { data: blogs } = await sb.from('blog_posts')
      .select('slug, title')
      .eq('is_published', true)
      .eq('category', 'apt')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(5000);

    if (!blogs?.length) return { processed: 0, complexes: topComplexes.length };

    // 3) 단지별 블로그 언급 수 계산
    const countMap = new Map<string, number>();
    for (const complex of topComplexes) {
      const name = complex.apt_name;
      if (!name || name.length < 3) continue; // 너무 짧은 이름 제외 (오매칭 방지)
      let cnt = 0;
      for (const blog of blogs) {
        if (blog.title?.includes(name)) cnt++;
      }
      if (cnt > 0) countMap.set(name, cnt);
    }

    // 4) 배치 업데이트
    let updated = 0;
    const entries = Array.from(countMap.entries());
    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50);
      const results = await Promise.allSettled(
        batch.map(([name, count]) =>
          (sb as any).from('apt_complex_profiles')
            .update({ blog_post_count: count, updated_at: new Date().toISOString() })
            .eq('apt_name', name)
        )
      );
      updated += results.filter(r => r.status === 'fulfilled').length;
    }

    return { processed: entries.length, updated, totalBlogs: blogs.length, totalComplexes: topComplexes.length };
  });

  return NextResponse.json({ ok: true, ...result });
}
