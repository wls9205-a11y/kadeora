/**
 * [image-source] blog-cover-auto-enhance — OG 커버 블로그 100건 →
 *  apt/apt_sub/redev/unsold → rematch_blog_cover RPC
 *  stock → match_blog_to_stock_logo RPC
 *  finance/general/guide → curated_image_pool 랜덤 pick (카테고리 일치)
 *  성공 시 blog_posts.cover_image UPDATE.
 *
 * 30m. verifyCronAuth + acquire_cron_lock.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'blog-cover-auto-enhance';
const BATCH = 100;
const PREEMPT_MS = 260_000;

const CURATED_CATS = new Set(['finance', 'general', 'guide']);
const APT_CATS = new Set(['apt', 'apt_sub', 'redev', 'unsold']);

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    // OG 커버 블로그만 대상
    const { data: posts } = await (admin as any)
      .from('blog_posts')
      .select('id, category, title, cover_image')
      .eq('is_published', true)
      .or('cover_image.ilike.%/api/og%,cover_image.is.null')
      .order('view_count', { ascending: false })
      .limit(BATCH);
    if (!posts || posts.length === 0) return NextResponse.json({ success: true, processed: 0, message: 'no og covers' });

    const stats = { processed: 0, matched: 0, skipped: 0, failed: 0, by_source: { apt: 0, stock: 0, curated: 0 } };
    const failures: string[] = [];

    for (const p of posts as any[]) {
      if (Date.now() - start > PREEMPT_MS) break;
      stats.processed++;
      const cat = String(p.category || '').toLowerCase();

      try {
        let newCover: string | null = null;
        let src: 'apt' | 'stock' | 'curated' | null = null;

        if (APT_CATS.has(cat)) {
          const { data } = await (admin as any).rpc('rematch_blog_cover', { p_blog_id: p.id });
          if (typeof data === 'string' && data.length > 10) { newCover = data; src = 'apt'; }
        } else if (cat === 'stock') {
          const { data } = await (admin as any).rpc('match_blog_to_stock_logo', { p_blog_id: p.id });
          if (typeof data === 'string' && data.length > 10) { newCover = data; src = 'stock'; }
        } else if (CURATED_CATS.has(cat)) {
          const { data: pool } = await (admin as any)
            .from('curated_image_pool')
            .select('image_url')
            .eq('category', cat)
            .order('used_count', { ascending: true, nullsFirst: true })
            .limit(10);
          if (Array.isArray(pool) && pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            if (pick?.image_url) { newCover = pick.image_url; src = 'curated'; }
          }
        }

        if (!newCover || !src) {
          stats.skipped++;
          continue;
        }

        await (admin as any).from('blog_posts').update({ cover_image: newCover }).eq('id', p.id);
        if (src === 'curated') {
          try {
            // used_count +1 (RPC 없으니 직접)
            const { data: row } = await (admin as any).from('curated_image_pool').select('id,used_count').eq('image_url', newCover).maybeSingle();
            if (row?.id) {
              await (admin as any).from('curated_image_pool').update({
                used_count: (row.used_count || 0) + 1,
                last_used_at: new Date().toISOString(),
              }).eq('id', row.id);
            }
          } catch { /* ignore */ }
        }
        stats.matched++;
        (stats.by_source as any)[src]++;
      } catch (err: any) {
        stats.failed++;
        failures.push(`${p.id}:${String(err?.message || err).slice(0, 80)}`);
      }
    }

    return NextResponse.json({ success: true, ...stats, sample_failures: failures.slice(0, 5), elapsed_ms: Date.now() - start });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;
