/**
 * [CI-v1 Task 6] blog-backfill-submit — Anthropic Batch API 로 이미지 키워드 500개 묶음 제출
 *
 * 6h 또는 1일 1회. queue pending LIMIT 500 → Batch Haiku 요청 생성 → /v1/messages/batches POST
 * → blog_image_batch INSERT → queue UPDATE status='in_progress', batch_id
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 120;

const LOCK_KEY = 'blog-backfill-submit';
const BATCH_SIZE = 500;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 120,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

    const { data: queueRows } = await (admin as any)
      .from('blog_image_backfill_queue')
      .select('id, post_id')
      .eq('status', 'pending')
      .lt('attempt_count', 3)
      .order('priority', { ascending: true })
      .limit(BATCH_SIZE);

    if (!queueRows || queueRows.length === 0) {
      return NextResponse.json({ success: true, submitted: 0, message: 'queue empty' });
    }

    const postIds: number[] = queueRows.map((r: any) => r.post_id).filter(Boolean);
    const { data: posts } = await admin
      .from('blog_posts')
      .select('id, title, excerpt, category, tags')
      .in('id', postIds);
    const postMap = new Map<number, any>();
    for (const p of (posts || []) as any[]) postMap.set(p.id, p);

    // Batch request 생성
    const requests = queueRows
      .filter((q: any) => postMap.has(q.post_id))
      .map((q: any) => {
        const post = postMap.get(q.post_id);
        return {
          custom_id: `post-${q.post_id}`,
          params: {
            model: AI_MODEL_HAIKU,
            max_tokens: 300,
            system: '당신은 한국 블로그 SEO 에디터입니다. 주어진 글 제목과 카테고리에 가장 잘 맞는 네이버 이미지 검색 키워드 5개를 JSON 배열로만 반환하세요. 구체적 엔티티(아파트명/종목/지역) 위주. 다른 텍스트 금지. 형식: ["키워드1","키워드2","키워드3","키워드4","키워드5"]',
            messages: [{
              role: 'user',
              content: `제목: ${String(post.title).slice(0, 80)}\n카테고리: ${post.category}\n태그: ${(post.tags || []).slice(0, 5).join(', ')}\n발췌: ${String(post.excerpt || '').slice(0, 200)}`,
            }],
          },
        };
      });

    if (requests.length === 0) {
      return NextResponse.json({ success: true, submitted: 0, message: 'no posts resolved' });
    }

    // Anthropic Batch API
    const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ requests }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!batchRes.ok) {
      const errBody = await batchRes.text().catch(() => '');
      throw new Error(`Batch API ${batchRes.status}: ${errBody.slice(0, 400)}`);
    }
    const batchData = await batchRes.json();
    const anthropicBatchId = batchData?.id;
    if (!anthropicBatchId) throw new Error('no batch id returned');

    // blog_image_batch INSERT
    const { data: batchRow, error: insErr } = await (admin as any)
      .from('blog_image_batch')
      .insert({
        anthropic_batch_id: anthropicBatchId,
        purpose: 'image_suggest',
        status: 'submitted',
        post_ids: postIds,
        request_count: requests.length,
        metadata: { model: AI_MODEL_HAIKU, queue_ids: queueRows.map((r: any) => r.id) },
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    // queue 상태 갱신
    await (admin as any)
      .from('blog_image_backfill_queue')
      .update({ status: 'in_progress', batch_id: batchRow?.id, started_at: new Date().toISOString() })
      .in('id', queueRows.map((r: any) => r.id));

    return NextResponse.json({
      success: true,
      submitted: requests.length,
      anthropic_batch_id: anthropicBatchId,
      internal_batch_id: batchRow?.id,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;
