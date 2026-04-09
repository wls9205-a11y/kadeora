import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('seo-internal-links', async () => {
    const sb = getSupabaseAdmin();
    let linked = 0;

    const { data: posts } = await sb
      .from('blog_posts').select('id, slug, title, category, content')
      .eq('is_published', true).gte('view_count', 50).limit(50);

    if (!posts?.length) return { processed: 0 };

    for (const post of posts) {
      if (post.content?.includes('## 📊 관련 분석')) continue;

      const { data: related } = await sb.from('blog_posts')
        .select('slug, title').eq('is_published', true).eq('category', post.category)
        .neq('id', post.id).gte('view_count', 10)
        .order('view_count', { ascending: false }).limit(3);

      if (!related?.length) continue;

      const linkSection = `\n\n## 📊 관련 분석\n\n${related.map((r: any) => `- [${r.title}](/blog/${r.slug})`).join('\n')}\n`;
      const { error } = await sb.from('blog_posts')
        .update({ content: post.content + linkSection }).eq('id', post.id);
      if (!error) linked++;
    }

    return { processed: posts.length, updated: linked };
  });
  return NextResponse.json({ ok: true, ...result });
});
