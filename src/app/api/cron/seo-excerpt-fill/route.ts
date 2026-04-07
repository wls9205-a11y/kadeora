export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * excerpt 미입력 블로그에 자동 요약문 생성 (AI 비용 0원)
 * content 첫 200자에서 의미 있는 문장 추출, 배치 500건/실행
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('seo-excerpt-fill', async () => {
    const sb = getSupabaseAdmin();

    const { data: posts } = await (sb as any).from('blog_posts')
      .select('id, title, content')
      .eq('is_published', true)
      .is('excerpt', null)
      .order('view_count', { ascending: false })
      .limit(500);

    if (!posts?.length) return { processed: 0, created: 0, failed: 0 };

    let updated = 0;
    for (const post of posts) {
      try {
        const content = (post.content || '').replace(/[#*_\-\[\]()>|`~]/g, '').replace(/\n+/g, ' ').trim();
        const sentences = content.split(/[.!?。]\s*/).filter((s: string) => s.length > 10);
        let excerpt = sentences.slice(0, 3).join('. ');
        if (excerpt.length > 150) excerpt = excerpt.slice(0, 147) + '...';
        if (excerpt.length < 30) excerpt = (post.title + ' — ' + content.slice(0, 100)).slice(0, 170);

        if (excerpt.length >= 30) {
          const { error } = await (sb as any).from('blog_posts').update({ excerpt }).eq('id', post.id);
          if (!error) updated++;
        }
      } catch { continue; }
    }

    return { processed: posts.length, created: updated, failed: posts.length - updated };
  });

  if (!result.success) return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
