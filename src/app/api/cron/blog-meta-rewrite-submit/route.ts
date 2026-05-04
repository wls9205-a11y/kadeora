/**
 * [CI-v1 Session D2] blog-meta-rewrite-submit — 1일 1회 Batch meta_description 재작성 요청
 *
 * blog_meta_rewrite_queue pending LIMIT 500 → Claude Haiku batch →
 * blog_image_batch (purpose='meta_rewrite') INSERT, queue 상태 갱신.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { getFreshnessContext } from '@/lib/blog/freshness-context';

export const runtime = 'nodejs';
export const maxDuration = 120;

const LOCK_KEY = 'blog-meta-rewrite-submit';
const BATCH_SIZE = 500;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 120,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

    const { data: rows } = await (admin as any)
      .from('blog_meta_rewrite_queue')
      .select('id, post_id, current_length, current_meta_description')
      .eq('status', 'pending')
      .lt('attempt_count', 3)
      .order('priority', { ascending: true })
      .limit(BATCH_SIZE);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, submitted: 0, message: 'queue empty' });
    }

    const postIds = rows.map((r: any) => r.post_id).filter(Boolean);
    const { data: posts } = await admin
      .from('blog_posts')
      .select('id, title, excerpt, category, content')
      .in('id', postIds);
    const postMap = new Map<number, any>();
    for (const p of (posts || []) as any[]) postMap.set(p.id, p);

    const requests = rows
      .filter((r: any) => postMap.has(r.post_id))
      .map((r: any) => {
        const post = postMap.get(r.post_id);
        return {
          custom_id: `post-${r.post_id}`,
          params: {
            model: AI_MODEL_HAIKU,
            max_tokens: 400,
            system: '당신은 한국 SEO 에디터입니다. 주어진 블로그 글 제목·카테고리·본문 발췌를 읽고 meta_description 을 한국어 150~160자로 재작성합니다. 2~3 문장, 클릭 유도, plain text (따옴표·마크다운 금지). 응답은 meta_description 문자열 그 자체만.\n\n' + getFreshnessContext(),
            messages: [{
              role: 'user',
              content: `제목: ${String(post.title).slice(0, 80)}\n카테고리: ${post.category}\n발췌: ${String(post.excerpt || '').slice(0, 220)}\n본문 앞부분: ${String(post.content || '').replace(/[#*>\n`|]/g, ' ').slice(0, 400)}`,
            }],
          },
        };
      });
    if (requests.length === 0) {
      return NextResponse.json({ success: true, submitted: 0, message: 'no posts resolved' });
    }

    const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify({ requests }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!batchRes.ok) {
      const errBody = await batchRes.text().catch(() => '');
      throw new Error(`Batch API ${batchRes.status}: ${errBody.slice(0, 400)}`);
    }
    const batchData = await batchRes.json();
    const anthropicBatchId = batchData?.id;
    if (!anthropicBatchId) throw new Error('no batch id');

    const { data: batchRow } = await (admin as any)
      .from('blog_image_batch')
      .insert({
        anthropic_batch_id: anthropicBatchId,
        purpose: 'meta_rewrite',
        status: 'submitted',
        post_ids: postIds,
        request_count: requests.length,
        metadata: { model: AI_MODEL_HAIKU, queue_ids: rows.map((r: any) => r.id) },
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    await (admin as any).from('blog_meta_rewrite_queue').update({
      status: 'in_progress',
      batch_id: batchRow?.id,
    }).in('id', rows.map((r: any) => r.id));

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
