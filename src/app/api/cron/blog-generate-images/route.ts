/**
 * [CI-v1 Task 5] blog-generate-images — queue-based 재구현
 *
 * 이전: cover_image '/api/og' 포함 포스트 전수 스캔 후 네이버 이미지 일괄 교체.
 * 현재: blog_image_backfill_queue 기반 배치 + image-relevance-v1 필터 + hydrateImage(Storage).
 *
 * 단계:
 *   1) verifyCronAuth (Vercel/pg_cron/Bearer)
 *   2) acquire_cron_lock('blog-generate-images', holder, 240) — Postgres lock
 *   3) queue WHERE status='pending' ORDER BY priority LIMIT 20
 *      → status='in_progress', started_at=NOW() UPDATE
 *   4) 각 row: runImagePipeline(post) — lib/image-pipeline.ts
 *   5) 성공 시 queue status='completed'; 실패 시 'failed', last_error
 *   6) finally: release_cron_lock
 *
 * cover_image 는 trg_bpi_cover_sync AFTER INSERT 트리거가 position 0 기준 자동 UPDATE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { runImagePipeline, type PostContext } from '@/lib/image-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'blog-generate-images';
const LOCK_TTL_SEC = 240;
const BATCH_SIZE = 20;
const PREEMPT_MS = 260_000;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const holder = `vercel-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  const startedAt = Date.now();

  // 1) acquire pg lock
  const { data: lockOk, error: lockErr } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY,
    p_holder: holder,
    p_ttl_seconds: LOCK_TTL_SEC,
  });
  if (lockErr) {
    console.error('[blog-generate-images] lock acquire error:', lockErr.message);
    return NextResponse.json({ success: false, error: lockErr.message }, { status: 500 });
  }
  if (!lockOk) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'pg_lock_held',
      holder,
    });
  }

  // cron_logs running row
  const { data: logRow } = await admin
    .from('cron_logs')
    .insert({ cron_name: 'blog-generate-images', status: 'running' })
    .select('id')
    .single();

  try {
    // 2) queue pick + status update
    const { data: queueRows, error: qErr } = await (admin as any)
      .from('blog_image_backfill_queue')
      .select('id, post_id, priority, attempt_count, current_image_count, target_image_count')
      .eq('status', 'pending')
      .lt('attempt_count', 3)
      .order('priority', { ascending: true })
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (qErr) throw qErr;
    if (!queueRows || queueRows.length === 0) {
      await finishCronLog(admin, logRow?.id, {
        processed: 0,
        metadata: { message: 'no pending queue rows' },
      });
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'empty queue',
        elapsed_ms: Date.now() - startedAt,
      });
    }

    const queueIds = queueRows.map((r: any) => r.id);
    await (admin as any)
      .from('blog_image_backfill_queue')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .in('id', queueIds);

    // 3) post metadata batch load
    const postIds = queueRows.map((r: any) => r.post_id).filter(Boolean);
    const { data: posts } = await admin
      .from('blog_posts')
      .select('id, slug, title, excerpt, category, sub_category, tags, source_ref')
      .in('id', postIds);
    const postMap = new Map<number, any>();
    for (const p of (posts || []) as any[]) postMap.set(p.id, p);

    // 4) 배치 처리
    const stats = {
      processed: 0,
      completed: 0,
      failed: 0,
      skipped_no_post: 0,
      total_storage_real: 0,
      total_og_placeholder: 0,
      total_candidates: 0,
    };
    const samples: any[] = [];
    const allFailures: string[] = [];

    for (const q of queueRows as any[]) {
      if (Date.now() - startedAt > PREEMPT_MS) {
        await (admin as any)
          .from('blog_image_backfill_queue')
          .update({ status: 'pending' })
          .eq('id', q.id);
        continue;
      }
      stats.processed++;
      const post = postMap.get(q.post_id);
      if (!post) {
        await (admin as any)
          .from('blog_image_backfill_queue')
          .update({
            status: 'failed',
            last_error: 'post_not_found',
            attempt_count: (q.attempt_count || 0) + 1,
          })
          .eq('id', q.id);
        stats.skipped_no_post++;
        continue;
      }

      const postCtx: PostContext = {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        category: (post.category || 'general').toLowerCase(),
        sub_category: post.sub_category,
        tags: post.tags,
        source_ref: post.source_ref,
      };

      try {
        const pipe = await runImagePipeline(admin, postCtx, {
          relevanceThreshold: 0.55,
          maxRealImages: 6,
          includeInfographicPosition: true,
          subdir: `blog/${new Date().toISOString().slice(0, 7)}/${post.id}`,
        });

        stats.total_storage_real += pipe.storage_real;
        stats.total_og_placeholder += pipe.og_placeholder;
        stats.total_candidates += pipe.candidates_count;
        allFailures.push(...pipe.failures);

        const isSuccess = pipe.storage_real > 0 || pipe.og_placeholder > 0;
        if (isSuccess) {
          stats.completed++;
          await (admin as any)
            .from('blog_image_backfill_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              current_image_count: pipe.storage_real + pipe.og_placeholder,
              attempt_count: (q.attempt_count || 0) + 1,
              last_error: null,
            })
            .eq('id', q.id);
        } else {
          stats.failed++;
          await (admin as any)
            .from('blog_image_backfill_queue')
            .update({
              status: 'failed',
              last_error: pipe.failures.slice(0, 3).join(' | ').slice(0, 500) || 'no_images_generated',
              attempt_count: (q.attempt_count || 0) + 1,
            })
            .eq('id', q.id);
        }

        if (samples.length < 5) {
          samples.push({
            post_id: post.id,
            title: String(post.title || '').slice(0, 40),
            category: postCtx.category,
            storage_real: pipe.storage_real,
            og: pipe.og_placeholder,
            candidates: pipe.candidates_count,
          });
        }
      } catch (err: any) {
        stats.failed++;
        allFailures.push(`${post.id}:ex:${err?.message || ''}`.slice(0, 200));
        await (admin as any)
          .from('blog_image_backfill_queue')
          .update({
            status: 'failed',
            last_error: (err?.message || 'unknown').slice(0, 500),
            attempt_count: (q.attempt_count || 0) + 1,
          })
          .eq('id', q.id);
      }
    }

    await finishCronLog(admin, logRow?.id, {
      processed: stats.processed,
      created: stats.total_storage_real,
      updated: stats.total_og_placeholder,
      failed: stats.failed,
      metadata: {
        ...stats,
        samples,
        sample_failures: allFailures.slice(0, 8),
        elapsed_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      success: true,
      ...stats,
      samples,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (err: any) {
    await finishCronLog(admin, logRow?.id, {
      failed: 1,
      metadata: { error: err?.message || 'unknown' },
      errorMessage: err?.message,
    });
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    try {
      await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
    } catch (relErr: any) {
      console.warn('[blog-generate-images] release lock failed:', relErr?.message);
    }
  }
}

async function finishCronLog(
  admin: ReturnType<typeof getSupabaseAdmin>,
  logId: string | undefined,
  result: {
    processed?: number;
    created?: number;
    updated?: number;
    failed?: number;
    metadata?: Record<string, any>;
    errorMessage?: string;
  },
) {
  if (!logId) return;
  try {
    await admin
      .from('cron_logs')
      .update({
        status: result.errorMessage ? 'failed' : 'success',
        finished_at: new Date().toISOString(),
        records_processed: result.processed || 0,
        records_created: result.created || 0,
        records_updated: result.updated || 0,
        records_failed: result.failed || 0,
        error_message: result.errorMessage || null,
        metadata: result.metadata || {},
      })
      .eq('id', logId);
  } catch { /* ignore */ }
}

export const GET = handler;
export const POST = handler;
