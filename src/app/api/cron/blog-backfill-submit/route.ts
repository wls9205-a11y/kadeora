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
import { jsonSafeSlice, findLoneSurrogateItems, LONE_SURROGATE_RE } from '@/lib/text-safe';

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
      .select('id, post_id, attempt_count')
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
      .select('id, slug, title, excerpt, category, tags')
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
            // ⚠️ `.slice()` 가 아니라 jsonSafeSlice 를 쓴다.
            //   slice 는 UTF-16 코드유닛 단위라 이모지(서로게이트 쌍)가 경계에
            //   걸리면 쌍을 쪼갠다. 반쪽이 JSON.stringify 에서 짝 없는 이스케이프로
            //   나가고 Batch API 가 400 으로 거절한다 — 배치는 전부 아니면 전무라
            //   한 건이 나머지 전부를 같이 죽인다(blog-meta-rewrite-submit 실사례).
            //
            //   지금 큐 7,007건에는 위험군이 0건이다. 그러나 excerpt 가 200자 초과 +
            //   이모지 보유인 글이 320건 있어 «큐에 들어오는 순간» 터진다. 미리 막는다.
            //   tags 는 배열 slice 라 안전하고, title 은 astral 문자가 0건이지만
            //   같이 처리하는 편이 싸다.
            messages: [{
              role: 'user',
              content: `제목: ${jsonSafeSlice(post.title, 80)}\n카테고리: ${post.category}\n태그: ${(post.tags || []).slice(0, 5).join(', ')}\n발췌: ${jsonSafeSlice(post.excerpt, 200)}`,
            }],
          },
        };
      });

    if (requests.length === 0) {
      return NextResponse.json({ success: true, submitted: 0, message: 'no posts resolved' });
    }

    // ── 제출 «전» 최종 검사 ──
    //   jsonSafeSlice 로 이미 막았지만, 예상 못 한 경로로 깨진 글자가 들어오면
    //   배치 전체가 400 으로 죽는다. 깨진 건만 빼고 나머지는 살린다.
    const idToSlug = new Map<number, string>();
    for (const p of (posts || []) as any[]) idToSlug.set(p.id, p.slug);
    const slugOf = (customId: string) => {
      const pid = Number(String(customId).replace(/^post-/, ''));
      return idToSlug.get(pid) || customId;
    };
    const contentOf = (r: any) => String(r?.params?.messages?.[0]?.content ?? '');

    const broken = findLoneSurrogateItems(
      requests as any[],
      (r: any) => [['content', contentOf(r)]],
      (r: any) => slugOf(r?.custom_id),
    );
    const clean = broken.length === 0
      ? requests
      : (requests as any[]).filter((r: any) => !LONE_SURROGATE_RE.test(contentOf(r)));
    if (broken.length > 0) {
      console.warn(`[blog-backfill-submit] 서로게이트 깨짐 ${broken.length}건 제외: ${broken.slice(0, 10).join(', ')}`);
    }
    if (clean.length === 0) {
      throw new Error(`전 건이 서로게이트 깨짐으로 제외됨 — ${broken.slice(0, 10).join(', ')}`);
    }

    // Anthropic Batch API
    const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ requests: clean }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!batchRes.ok) {
      const errBody = await batchRes.text().catch(() => '');

      // 크레딧 소진은 «코드 문제가 아니다» — 일반 실패와 구분해 남긴다.
      if (batchRes.status === 400 && /credit balance is too low/i.test(errBody)) {
        throw new Error(
          `CREDIT_EXHAUSTED: Anthropic 크레딧 잔액 부족 — 코드 문제가 아니다. `
          + `충전 전까지 계속 실패한다. 제출 예정 ${clean.length}건은 pending 그대로 남아 `
          + `충전 후 자동 재시도된다. 원문: ${errBody.slice(0, 200)}`,
        );
      }

      // 서로게이트면 어느 글이 원인인지 slug 로 찍는다.
      if (/surrogate/i.test(errBody)) {
        const culprits = findLoneSurrogateItems(
          clean as any[],
          (r: any) => [['content', contentOf(r)]],
          (r: any) => slugOf(r?.custom_id),
        );
        throw new Error(
          `Batch API ${batchRes.status} 서로게이트 깨짐 — 원인 ${culprits.length}건: `
          + `${culprits.slice(0, 10).join(', ')}. 원문: ${errBody.slice(0, 200)}`,
        );
      }

      throw new Error(`Batch API ${batchRes.status}: ${errBody.slice(0, 400)}`);
    }
    const batchData = await batchRes.json();
    const anthropicBatchId = batchData?.id;
    if (!anthropicBatchId) throw new Error('no batch id returned');

    // «실제로 제출된» 건만 추린다. 제외분까지 in_progress 로 넘기면 배치 결과가
    //   영원히 안 와서 묶인 채 다음 pending 조회에도 안 잡힌다(조용히 사라짐).
    const submittedPostIds = new Set(
      (clean as any[]).map((r: any) => Number(String(r.custom_id).replace(/^post-/, ''))),
    );
    const submittedQueueIds = queueRows
      .filter((r: any) => submittedPostIds.has(r.post_id))
      .map((r: any) => r.id);

    // blog_image_batch INSERT
    const { data: batchRow, error: insErr } = await (admin as any)
      .from('blog_image_batch')
      .insert({
        anthropic_batch_id: anthropicBatchId,
        purpose: 'image_suggest',
        status: 'submitted',
        post_ids: [...submittedPostIds],
        request_count: clean.length,
        metadata: { model: AI_MODEL_HAIKU, queue_ids: submittedQueueIds },
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    // queue 상태 갱신 — «실제로 제출된» 건만.
    await (admin as any)
      .from('blog_image_backfill_queue')
      .update({ status: 'in_progress', batch_id: batchRow?.id, started_at: new Date().toISOString() })
      .in('id', submittedQueueIds);

    // 제외분은 pending 으로 두고 attempt_count 만 올린다. 3회면 큐에서 빠진다.
    // 이 큐에는 last_error 컬럼이 «있다»(컬럼 실재 확인) — 사유를 남긴다.
    for (const r of queueRows.filter((r: any) => !submittedPostIds.has(r.post_id))) {
      const { error: excErr } = await (admin as any)
        .from('blog_image_backfill_queue')
        .update({ attempt_count: (r.attempt_count || 0) + 1, last_error: 'lone_surrogate' })
        .eq('id', r.id).select('id');
      if (excErr) console.warn(`[blog-backfill-submit] attempt_count 증가 실패 id=${r.id}: ${excErr.message}`);
    }

    return NextResponse.json({
      success: true,
      submitted: clean.length,
      excluded_broken: broken.length,
      excluded_slugs: broken.slice(0, 10),
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
