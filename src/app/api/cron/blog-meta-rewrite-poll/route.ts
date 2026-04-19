/**
 * [CI-v1 Session D2] blog-meta-rewrite-poll — 10m Batch 결과 수신 + blog_posts.meta_description UPDATE
 *
 * blog_image_batch WHERE purpose='meta_rewrite' AND status IN ('submitted','in_progress') LIMIT 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ANTHROPIC_VERSION } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 180;

const LOCK_KEY = 'blog-meta-rewrite-poll';
const MAX_BATCHES = 3;
const PREEMPT_MS = 160_000;

function stripToPlainText(s: string): string {
  return s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["「」『』""'']/g, '')
    .replace(/[#*`>|_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampMeta(s: string): string {
  const t = stripToPlainText(s);
  if (t.length <= 160 && t.length >= 140) return t;
  if (t.length > 160) return t.slice(0, 160);
  return (t + ' · 카더라 데이터 분석').slice(0, 160);
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 200,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

    const { data: batches } = await (admin as any)
      .from('blog_image_batch')
      .select('id, anthropic_batch_id, status, post_ids, metadata, results_processed')
      .eq('purpose', 'meta_rewrite')
      .in('status', ['submitted', 'in_progress'])
      .eq('results_processed', false)
      .order('submitted_at', { ascending: true })
      .limit(MAX_BATCHES);
    if (!batches || batches.length === 0) {
      return NextResponse.json({ success: true, polled: 0 });
    }

    const stats = { polled: 0, ended: 0, updated: 0, errored: 0 };
    const failures: string[] = [];

    for (const b of batches as any[]) {
      if (Date.now() - start > PREEMPT_MS) break;
      stats.polled++;

      const statusRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${b.anthropic_batch_id}`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
        signal: AbortSignal.timeout(30_000),
      });
      if (!statusRes.ok) {
        failures.push(`${b.id}:status_${statusRes.status}`);
        continue;
      }
      const statusData = await statusRes.json();
      const processing = statusData?.processing_status;
      const resultsUrl = statusData?.results_url;

      if (processing !== 'ended') {
        await (admin as any).from('blog_image_batch').update({
          status: 'in_progress',
          request_count: statusData?.request_counts?.total || 0,
          updated_at: new Date().toISOString(),
        }).eq('id', b.id);
        continue;
      }
      stats.ended++;

      if (!resultsUrl) {
        failures.push(`${b.id}:no_url`);
        continue;
      }

      const rRes = await fetch(resultsUrl, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
        signal: AbortSignal.timeout(60_000),
      });
      if (!rRes.ok) {
        failures.push(`${b.id}:res_${rRes.status}`);
        continue;
      }
      const jsonl = await rRes.text();
      const lines = jsonl.split('\n').filter(Boolean);

      const updates: { post_id: number; new_meta: string }[] = [];
      for (const line of lines) {
        try {
          const row = JSON.parse(line);
          const cid = String(row.custom_id || '');
          const m = cid.match(/^post-(\d+)$/);
          if (!m) continue;
          const postId = Number(m[1]);
          if (row.result?.type === 'succeeded') {
            const text = row.result.message?.content?.[0]?.text || '';
            const meta = clampMeta(String(text));
            if (meta.length >= 140 && meta.length <= 160) {
              updates.push({ post_id: postId, new_meta: meta });
            }
          } else if (row.result?.type === 'errored') {
            stats.errored++;
          }
        } catch { /* skip */ }
      }

      // UPDATE blog_posts + queue
      for (const u of updates) {
        try {
          await admin
            .from('blog_posts')
            .update({ meta_description: u.new_meta })
            .eq('id', u.post_id);
          await (admin as any)
            .from('blog_meta_rewrite_queue')
            .update({
              status: 'completed',
              new_meta_description: u.new_meta,
              completed_at: new Date().toISOString(),
            })
            .eq('post_id', u.post_id)
            .eq('batch_id', b.id);
          stats.updated++;
        } catch (err: any) {
          failures.push(`upd${u.post_id}:${err?.message || ''}`.slice(0, 120));
        }
      }

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

    return NextResponse.json({ success: true, ...stats, sample_failures: failures.slice(0, 5) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;
