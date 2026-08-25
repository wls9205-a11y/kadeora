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
import { jsonSafeSlice, findLoneSurrogateItems, LONE_SURROGATE_RE } from '@/lib/text-safe';

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
      .select('id, post_id, current_length, current_meta_description, attempt_count')
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
      .select('id, slug, title, excerpt, category, content')
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
            // ⚠️ `.slice()` 가 아니라 jsonSafeSlice 를 쓴다.
            //   slice 는 UTF-16 코드유닛 단위라 이모지(서로게이트 쌍)가 경계에
            //   걸리면 쌍을 쪼갠다. 그 반쪽이 JSON.stringify 에서 `\ud83d` 같은
            //   짝 없는 이스케이프로 나가고 Batch API 가 400 으로 거절한다.
            //   배치는 전부 아니면 전무라 «한 건이 나머지 499건을 같이 죽인다».
            //   실측 — 큐 500건 중 깨진 건 1건(apt-ann-2026000078 의 content)이었다.
            messages: [{
              role: 'user',
              content: `제목: ${jsonSafeSlice(post.title, 80)}\n카테고리: ${post.category}\n발췌: ${jsonSafeSlice(post.excerpt, 220)}\n본문 앞부분: ${jsonSafeSlice(String(post.content || '').replace(/[#*>\n`|]/g, ' '), 400)}`,
            }],
          },
        };
      });
    if (requests.length === 0) {
      return NextResponse.json({ success: true, submitted: 0, message: 'no posts resolved' });
    }

    // ── 제출 «전» 최종 검사 ──
    //   jsonSafeSlice 로 이미 막았지만, 예상 못 한 경로로 깨진 글자가 들어오면
    //   배치 전체가 400 으로 죽는다(전부 아니면 전무). 그래서 한 건만 빼고
    //   나머지는 살린다 — 499건을 1건 때문에 잃지 않는다.
    const idToSlug = new Map<number, string>();
    for (const p of (posts || []) as any[]) idToSlug.set(p.id, p.slug);
    const slugOf = (customId: string) => {
      const pid = Number(String(customId).replace(/^post-/, ''));
      return idToSlug.get(pid) || customId;
    };

    const broken = findLoneSurrogateItems(
      requests as any[],
      (r: any) => [['content', String(r?.params?.messages?.[0]?.content ?? '')]],
      (r: any) => slugOf(r?.custom_id),
    );
    const clean = broken.length === 0
      ? requests
      : (requests as any[]).filter((r: any) =>
          !LONE_SURROGATE_RE.test(String(r?.params?.messages?.[0]?.content ?? '')));
    if (broken.length > 0) {
      console.warn(`[blog-meta-rewrite-submit] 서로게이트 깨짐 ${broken.length}건 제외: ${broken.slice(0, 10).join(', ')}`);
    }
    if (clean.length === 0) {
      throw new Error(`전 건이 서로게이트 깨짐으로 제외됨 — ${broken.slice(0, 10).join(', ')}`);
    }

    const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify({ requests: clean }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!batchRes.ok) {
      const errBody = await batchRes.text().catch(() => '');

      // ── 크레딧 소진을 «일반 실패와 구분해서» 남긴다 ──
      //   코드 문제가 아닌데 코드 버그로 오인해 헤매는 시간을 없앤다.
      if (batchRes.status === 400 && /credit balance is too low/i.test(errBody)) {
        throw new Error(
          `CREDIT_EXHAUSTED: Anthropic 크레딧 잔액 부족 — 코드 문제가 아니다. `
          + `콘솔에서 충전 전까지 이 크론은 계속 실패한다. 제출 예정 ${requests.length}건은 `
          + `pending 그대로 남아 있으니 충전 후 자동 재시도된다. 원문: ${errBody.slice(0, 200)}`,
        );
      }

      // ── 서로게이트 깨짐이면 «어느 글이 원인인지» 찍는다 ──
      //   지금까지 알 방법이 전혀 없었다. 배치가 전부 아니면 전무라 한 건만 깨져도
      //   500건이 통째로 죽는데, 로그에는 API 문구만 남았다.
      if (/surrogate/i.test(errBody)) {
        const culprits = findLoneSurrogateItems(
          clean as any[],
          (r: any) => [['content', String(r?.params?.messages?.[0]?.content ?? '')]],
          (r: any) => slugOf(r?.custom_id),
        );
        throw new Error(
          `Batch API ${batchRes.status} 서로게이트 깨짐 — 원인 ${culprits.length}건: `
          + `${culprits.slice(0, 10).join(', ')}${culprits.length > 10 ? ` 외 ${culprits.length - 10}건` : ''}. `
          + `원문: ${errBody.slice(0, 200)}`,
        );
      }

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
        post_ids: (clean as any[]).map((r: any) => Number(String(r.custom_id).replace(/^post-/, ''))),
        request_count: clean.length,
        metadata: { model: AI_MODEL_HAIKU, queue_ids: rows.map((r: any) => r.id) },
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // ⚠️ «실제로 제출된» 건만 in_progress 로 넘긴다.
    //   제외된 건까지 넘기면 배치 결과가 영원히 안 와서 in_progress 로 묶인 채
    //   다음 회차 pending 조회에도 안 잡힌다 — 조용히 사라지는 것과 같다.
    const submittedPostIds = new Set(
      (clean as any[]).map((r: any) => Number(String(r.custom_id).replace(/^post-/, ''))),
    );
    const submittedQueueIds = rows
      .filter((r: any) => submittedPostIds.has(r.post_id))
      .map((r: any) => r.id);

    await (admin as any).from('blog_meta_rewrite_queue').update({
      status: 'in_progress',
      batch_id: batchRow?.id,
    }).in('id', submittedQueueIds);

    // 제외된 건은 pending 으로 두되 attempt_count 를 올린다 —
    // 3회면 큐에서 빠져 같은 글이 매일 다시 잡히는 것을 막는다.
    //   ⚠️ `last_error` 컬럼을 쓰려다 뺐다 — blog_meta_rewrite_queue 에 없다.
    //      없는 컬럼이 섞이면 PostgREST 가 update 를 통째로 거절한다(PGRST204).
    //      apt-parse-announcement 가 넉 달 죽어 있던 원인이 정확히 이것이었다.
    //      사유는 위 console.warn 과 응답 excluded_slugs 에 남는다.
    const excludedRows = rows.filter((r: any) => !submittedPostIds.has(r.post_id));
    for (const r of excludedRows) {
      const { error: excErr } = await (admin as any).from('blog_meta_rewrite_queue')
        .update({ attempt_count: (r.attempt_count || 0) + 1 })
        .eq('id', r.id).select('id');
      if (excErr) console.warn(`[blog-meta-rewrite-submit] attempt_count 증가 실패 id=${r.id}: ${excErr.message}`);
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
