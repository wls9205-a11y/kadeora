/**
 * [CI-v1 Session D3] faq-extract — 블로그 content 에서 FAQ 파싱 → blog_faq_cache UPSERT
 *
 * 04:00 KST (19:00 UTC). 250/run. 아직 캐시 없거나 최근 7일 미갱신 포스트 대상.
 * parseFaqFromContent 는 이미 src/lib/blog-faq-parser.ts 에 존재 (Q/A 형식, H2 "자주 묻는 질문" 등 파싱).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { parseFaqFromContent } from '@/lib/blog-faq-parser';

export const runtime = 'nodejs';
export const maxDuration = 120;

const LOCK_KEY = 'faq-extract';
const BATCH_SIZE = 250;
const PREEMPT_MS = 100_000;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 120,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    // 캐시 없는 post + 발행된 것 우선
    const { data: posts } = await admin
      .from('blog_posts')
      .select('id, content, title, updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(BATCH_SIZE * 4);

    if (!posts || posts.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'no posts' });
    }

    // 캐시 미존재/오래된 것 선별
    const postIds = posts.map((p: any) => p.id);
    const { data: cached } = await (admin as any)
      .from('blog_faq_cache')
      .select('post_id, extracted_at')
      .in('post_id', postIds);
    const cacheMap = new Map<number, string>();
    for (const c of (cached || []) as any[]) cacheMap.set(c.post_id, c.extracted_at);
    const weekAgo = Date.now() - 7 * 24 * 3600_000;

    const targets = posts
      .filter((p: any) => {
        const cachedAt = cacheMap.get(p.id);
        if (!cachedAt) return true;
        return new Date(cachedAt).getTime() < weekAgo;
      })
      .slice(0, BATCH_SIZE);

    const stats = { processed: 0, upserted: 0, empty: 0 };
    const upserts: { post_id: number; faqs: any; extracted_at: string; extraction_method: string }[] = [];

    for (const p of targets as any[]) {
      if (Date.now() - start > PREEMPT_MS) break;
      stats.processed++;
      const faqs = parseFaqFromContent(String(p.content || ''));
      if (faqs.length === 0) {
        stats.empty++;
        continue;
      }
      upserts.push({
        post_id: p.id,
        faqs,
        extracted_at: new Date().toISOString(),
        extraction_method: 'markdown-parser-v1',
      });
    }

    if (upserts.length > 0) {
      const { error } = await (admin as any)
        .from('blog_faq_cache')
        .upsert(upserts, { onConflict: 'post_id' });
      if (error) throw error;
      stats.upserted = upserts.length;
    }

    return NextResponse.json({
      success: true,
      ...stats,
      candidates: targets.length,
      elapsed_ms: Date.now() - start,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;
