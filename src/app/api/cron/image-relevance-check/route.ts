/**
 * [CI-v1] image-relevance-check — image_relevance_queue 50건 pick →
 *  Supabase Edge Function image-relevance-v1 (vision mode) 호출 →
 *  queue row + blog_post_images (target_table 일치 시) relevance_score/reason 반영.
 *
 * 10m 크론. maxDuration 300s. verifyCronAuth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH = 50;
const LOCK_KEY = 'image-relevance-check';
const PREEMPT_MS = 260_000;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error('supabase env missing');

    const { data: items, error: qErr } = await (admin as any)
      .from('image_relevance_queue')
      .select('id, target_table, target_id, target_uuid, image_url, subject_text, attempts')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(BATCH);
    if (qErr) throw qErr;
    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'queue empty' });
    }

    const ids = items.map((i: any) => i.id);
    await (admin as any)
      .from('image_relevance_queue')
      .update({ status: 'processing' })
      .in('id', ids);

    const edgeUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/image-relevance-v1`;
    const stats = { processed: 0, done: 0, failed: 0, low: 0, high: 0 };
    const failures: string[] = [];

    for (const item of items as any[]) {
      if (Date.now() - start > PREEMPT_MS) {
        // 남은 건은 pending 복구 (attempts 증가 없이)
        await (admin as any)
          .from('image_relevance_queue')
          .update({ status: 'pending' })
          .eq('id', item.id);
        continue;
      }
      stats.processed++;
      const nextAttempts = (item.attempts ?? 0) + 1;

      try {
        const res = await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_url: item.image_url,
            context: {
              title: String(item.subject_text || '').slice(0, 120),
            },
            mode: 'vision',
            skip_head: false,
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`edge ${res.status}: ${txt.slice(0, 200)}`);
        }
        const body: any = await res.json();
        if (!body || body.ok === false) {
          throw new Error(`edge_fail:${body?.error || 'no_body'}`);
        }

        const score01: number = Number(body.score ?? 0);
        const relevance_score: number = Math.max(0, Math.min(100, Math.round(score01 * 100)));
        const reason: string = Array.isArray(body.reasons) ? body.reasons.join(' | ').slice(0, 500) : '';

        await (admin as any)
          .from('image_relevance_queue')
          .update({
            status: 'done',
            relevance_score,
            reason,
            checked_at: new Date().toISOString(),
            attempts: nextAttempts,
            error_message: null,
          })
          .eq('id', item.id);

        if (item.target_table === 'blog_post_images' && item.target_id) {
          await (admin as any)
            .from('blog_post_images')
            .update({
              relevance_score,
              relevance_checked_at: new Date().toISOString(),
            })
            .eq('id', item.target_id);
        }

        stats.done++;
        if (relevance_score < 50) stats.low++;
        if (relevance_score >= 70) stats.high++;
      } catch (err: any) {
        await (admin as any)
          .from('image_relevance_queue')
          .update({
            status: 'failed',
            error_message: String(err?.message || err).slice(0, 500),
            attempts: nextAttempts,
          })
          .eq('id', item.id);
        stats.failed++;
        failures.push(`${item.id}:${String(err?.message || err).slice(0, 100)}`);
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
