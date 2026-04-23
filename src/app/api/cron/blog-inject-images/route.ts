/**
 * 세션 146 B4 — 블로그 본문에 /api/og 인라인 이미지 자동 삽입.
 *
 * 배치: view_count DESC, 본문 이미지 0 인 posts, 100/run.
 * 런타임 가드 250s.
 * 아키텍처 룰 #5: 에러여도 200 반환.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { injectInlineImages } from '@/lib/blog/inject-inline-images';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH = 100;
const PREEMPT_MS = 250_000;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return new NextResponse('ok', { status: 200 });
  const start = Date.now();
  const sb = getSupabaseAdmin();

  try {
    // 본문에 image markdown 이 없는 post 찾기 — PostgREST not ilike 필터 활용
    const { data: posts } = await (sb as any)
      .from('blog_posts')
      .select('id, title, category, tags, content, metadata')
      .eq('is_published', true)
      .gte('content_length', 800)
      .not('content', 'ilike', '%![%')
      .not('content', 'ilike', '%<img%')
      .order('view_count', { ascending: false })
      .limit(BATCH);

    if (!posts || posts.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'nothing to inject' });
    }

    let updated = 0;
    let skipped = 0;
    let totalInserts = 0;

    for (const p of posts as any[]) {
      if (Date.now() - start > PREEMPT_MS) break;
      const region = p.tags?.find((t: string) => /시$|도$|군$|구$/.test(t)) || null;
      const result = injectInlineImages({
        title: p.title || '',
        category: p.category || 'blog',
        tags: p.tags,
        region,
        markdown: p.content || '',
      });
      if (!result.updated) { skipped++; continue; }
      const { error } = await (sb as any)
        .from('blog_posts')
        .update({ content: result.markdown })
        .eq('id', p.id);
      if (!error) {
        updated++;
        totalInserts += result.inserted;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: posts.length,
      updated,
      skipped,
      inserted_images: totalInserts,
      elapsed_ms: Date.now() - start,
    });
  } catch (err: any) {
    return new NextResponse('ok', { status: 200 });
  }
}

export const GET = handler;
export const POST = handler;
