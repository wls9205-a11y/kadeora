/**
 * [CI-v1 Task 8] naver-hotlink-migrate — 기존 hotlink(naver_hotlink/pstatic/google_hotlink) 를 Storage 로 내재화
 *
 * 15m. 50/run. blog_post_images 대상 row 조회 → hydrateImage (Referer 헤더 포함) →
 *   성공: image_url, source_origin='storage', image_kind='storage_real' UPDATE
 *   실패: image_kind='unknown' downgrade
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { hydrateImage } from '@/lib/image-hydrate';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'naver-hotlink-migrate';
const BATCH_SIZE = 50;
const PREEMPT_MS = 260_000;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const { data: rows } = await (admin as any)
      .from('blog_post_images')
      .select('id, post_id, position, image_url, alt_text, caption, image_kind, source_origin')
      .in('source_origin', ['naver_hotlink', 'naver_pstatic', 'google_hotlink'])
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'no hotlinks pending' });
    }

    const stats = { processed: 0, migrated: 0, downgraded: 0, failed: 0 };
    const failures: string[] = [];

    for (const r of rows as any[]) {
      if (Date.now() - start > PREEMPT_MS) break;
      stats.processed++;

      try {
        const res = await hydrateImage(admin, r.image_url, {
          subdir: `blog/migrated/${r.post_id}`,
          maxWidth: 1200,
          maxHeight: 800,
          quality: 82,
        });

        if (res.ok) {
          await (admin as any)
            .from('blog_post_images')
            .update({
              image_url: res.url,
              source_origin: 'storage',
              image_kind: 'storage_real',
              storage_path: res.storagePath,
            })
            .eq('id', r.id);
          stats.migrated++;
        } else {
          // fetch 실패 등 → downgrade
          await (admin as any)
            .from('blog_post_images')
            .update({ image_kind: 'unknown' })
            .eq('id', r.id);
          stats.downgraded++;
          failures.push(`${r.id}:${res.reason}`);
        }
      } catch (err: any) {
        stats.failed++;
        failures.push(`${r.id}:ex:${err?.message || ''}`.slice(0, 120));
      }
    }

    return NextResponse.json({
      success: true,
      ...stats,
      sample_failures: failures.slice(0, 5),
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
