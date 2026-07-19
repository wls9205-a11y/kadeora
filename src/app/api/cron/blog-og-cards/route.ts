import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildBlogOgCards } from '@/lib/blog-og-cards';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 300;

// 발행글 중 og_cards 가 빈 배열([])인 것을 결정적으로 채운다. 발행 로직 어디서도 og_cards 를
// 생성하지 않아 신규글이 계속 빈 채로 쌓이던 것을 이 크론이 커버. og_cards_updated_at 도 같이 기록.
async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('blog-og-cards', async () => {
      const sb = getSupabaseAdmin();

      const { data: posts } = await (sb as any).from('blog_posts')
        .select('id, slug, title')
        .eq('is_published', true)
        .eq('og_cards', '[]')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(BATCH);

      const targets = (posts || []) as { id: unknown; slug: string; title: string | null }[];
      const now = new Date().toISOString();
      let updated = 0;
      const failures: string[] = [];

      for (const p of targets) {
        try {
          const cards = buildBlogOgCards(p.slug, p.title);
          const { error } = await (sb as any).from('blog_posts')
            .update({ og_cards: cards, og_cards_updated_at: now })
            .eq('id', p.id);
          if (error) failures.push(`${p.id}:${error.message}`);
          else updated++;
        } catch (e: any) {
          failures.push(`${p.id}:${e?.message ?? 'unknown'}`);
        }
      }

      return {
        processed: targets.length,
        created: updated,
        updated,
        failed: failures.length,
        metadata: { batch: BATCH, sample_failures: failures.slice(0, 5) },
      };
    }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
