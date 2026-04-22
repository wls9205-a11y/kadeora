/**
 * [CI-v1 Task 6] blog-backfill-poll — Anthropic Batch 결과 수신 + 이미지 파이프라인 실행
 *
 * 10m. blog_image_batch WHERE status IN ('submitted','in_progress') LIMIT 5
 * → GET /v1/messages/batches/{id}
 * → processing_status='ended' 시 results_url JSONL fetch
 * → 각 응답 (keyword 배열) 기반 네이버 이미지 검색 top 3 → image-relevance-v1 + hydrateImage
 * → record_blog_image + queue UPDATE completed + mark_batch_completed RPC
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ANTHROPIC_VERSION } from '@/lib/constants';
import { runImagePipeline, type PostContext } from '@/lib/image-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'blog-backfill-poll';
const MAX_BATCHES = 5;
const PREEMPT_MS = 260_000;

interface BatchResultLine {
  custom_id: string;
  result?: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired';
    message?: { content?: Array<{ type: string; text?: string }> };
    error?: { type: string; message: string };
  };
}

function parseKeywords(text: string): string[] {
  if (!text) return [];
  const clean = text.replace(/```json|```/g, '').trim();
  try {
    const p = JSON.parse(clean);
    if (Array.isArray(p)) return p.map(String).filter(Boolean).slice(0, 5);
  } catch { /* fallback */ }
  // fallback: 라인 분리
  return clean.split(/[,\n]/).map((s) => s.replace(/["\[\]]/g, '').trim()).filter(Boolean).slice(0, 5);
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

    const { data: batches } = await (admin as any)
      .from('blog_image_batch')
      .select('id, anthropic_batch_id, status, post_ids, metadata, results_processed')
      .in('status', ['submitted', 'in_progress'])
      .eq('results_processed', false)
      .order('submitted_at', { ascending: true })
      .limit(MAX_BATCHES);

    if (!batches || batches.length === 0) {
      return NextResponse.json({ success: true, polled: 0, message: 'no active batches' });
    }

    const stats = { polled: 0, ended: 0, processed_posts: 0, storage_real: 0, og_placeholder: 0, failed: 0 };
    const failures: string[] = [];

    for (const b of batches as any[]) {
      if (Date.now() - start > PREEMPT_MS) break;
      stats.polled++;

      const statusRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${b.anthropic_batch_id}`, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!statusRes.ok) {
        failures.push(`${b.id}:status_${statusRes.status}`);
        continue;
      }
      const statusData = await statusRes.json();
      const processing = statusData?.processing_status; // in_progress | ended | canceling
      const resultsUrl = statusData?.results_url;

      if (processing !== 'ended') {
        // 아직 처리 중 → 다음 poll 대기
        await (admin as any).from('blog_image_batch').update({
          status: 'in_progress',
          request_count: statusData?.request_counts?.total || b.request_count,
          completed_count: (statusData?.request_counts?.succeeded || 0) + (statusData?.request_counts?.errored || 0),
          errored_count: statusData?.request_counts?.errored || 0,
          updated_at: new Date().toISOString(),
        }).eq('id', b.id);
        continue;
      }
      stats.ended++;

      if (!resultsUrl) {
        failures.push(`${b.id}:no_results_url`);
        continue;
      }

      // JSONL 다운로드
      const rRes = await fetch(resultsUrl, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
        signal: AbortSignal.timeout(60_000),
      });
      if (!rRes.ok) {
        failures.push(`${b.id}:results_${rRes.status}`);
        continue;
      }
      const jsonl = await rRes.text();
      const lines = jsonl.split('\n').filter(Boolean);

      const keywordsByPostId = new Map<number, string[]>();
      for (const line of lines) {
        try {
          const row: BatchResultLine = JSON.parse(line);
          const cid = String(row.custom_id || '');
          const m = cid.match(/^post-(\d+)$/);
          if (!m) continue;
          const postId = Number(m[1]);
          if (row.result?.type === 'succeeded') {
            const text = row.result.message?.content?.[0]?.text || '';
            const kws = parseKeywords(text);
            if (kws.length > 0) keywordsByPostId.set(postId, kws);
          }
        } catch { /* skip malformed line */ }
      }

      // 각 post 에 대해 pipeline 실행
      const { data: posts } = await admin
        .from('blog_posts')
        .select('id, slug, title, excerpt, category, sub_category, tags, source_ref')
        .in('id', Array.from(keywordsByPostId.keys()));
      const postMap = new Map<number, any>();
      for (const p of (posts || []) as any[]) postMap.set(p.id, p);

      for (const [postId, kws] of keywordsByPostId.entries()) {
        if (Date.now() - start > PREEMPT_MS) break;
        const post = postMap.get(postId);
        if (!post) continue;

        const postCtx: PostContext = {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          category: (post.category || 'general').toLowerCase(),
          sub_category: post.sub_category,
          tags: Array.from(new Set([...(post.tags || []), ...kws])).slice(0, 10),
          source_ref: post.source_ref,
        };

        try {
          const pipe = await runImagePipeline(admin, postCtx, {
            relevanceThreshold: 0.5,
            maxRealImages: 6,
            includeInfographicPosition: true,
            subdir: `blog/batch/${b.id}/${postId}`,
          });
          stats.processed_posts++;
          stats.storage_real += pipe.storage_real;
          stats.og_placeholder += pipe.og_placeholder;

          // queue 완료 갱신
          await (admin as any).from('blog_image_backfill_queue').update({
            status: pipe.storage_real > 0 ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            current_image_count: pipe.storage_real + pipe.og_placeholder,
            last_error: pipe.failures.slice(0, 3).join(' | ').slice(0, 500) || null,
          }).eq('post_id', postId).eq('batch_id', b.id);
        } catch (err: any) {
          stats.failed++;
          failures.push(`post${postId}:${err?.message || ''}`.slice(0, 150));
        }
      }

      // batch 완료 표기
      await (admin as any).from('blog_image_batch').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        results_processed: true,
        completed_count: statusData?.request_counts?.succeeded || 0,
        errored_count: statusData?.request_counts?.errored || 0,
      }).eq('id', b.id);
      try { await (admin as any).rpc('mark_batch_completed', { p_batch_id: b.id }); } catch { /* ignore */ }
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
