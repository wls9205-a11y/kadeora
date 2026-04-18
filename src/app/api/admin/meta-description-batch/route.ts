/**
 * [L3-9] meta_description 일괄 재생성 — Anthropic Batch API (50% 할인)
 *
 * POST /api/admin/meta-description-batch
 *   body: { limit?: number } — 최대 대상 글 수 (기본 500, 최대 2000)
 *   응답: { batch_id, count, estimated_cost_usd }
 *
 * GET  /api/admin/meta-description-batch?batch_id=...
 *   응답: Anthropic Batch 상태 + rewrite_batches row
 *
 * 대상: is_published=true AND length(meta_description) < 80
 * 프롬프트: 기존 meta_description 개선 — 80~160자, 감정+숫자 포함, ## 형식 금지
 *
 * 실제 결과 반영은 batch-rewrite-poll 크론이 처리 (동일 구조).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';

export const maxDuration = 60;

const ANTHROPIC_BATCH_URL = 'https://api.anthropic.com/v1/messages/batches';

function buildPrompt(title: string, category: string, current: string | null): string {
  const catKo = category === 'stock' ? '주식' : category === 'apt' ? '부동산·청약' : category === 'unsold' ? '미분양' : category === 'finance' ? '재테크' : '금융';
  return `카더라(${catKo}) 블로그의 meta description을 개선해라.

제목: ${title}
현재: ${current || '(없음)'}

규칙 (매우 엄격):
- 80~160자 (엄수)
- 감정 트리거 1개 + 숫자 1개 포함 (예: "TOP 10 비교", "3년 만의 변동", "5분 요약")
- "##", "**", "목차" 등 마크다운/HTML 금지
- 특정 종목/단지 매수·매도 권유 금지
- 마지막에 "— 카더라" 고정 접미 금지 (SEO 중복)
- 평서문으로 끝맺기, 물음표 금지

출력: 개선된 meta description 본문만 (앞뒤 설명 금지).`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const rawLimit = Number(body?.limit || 500);
  const limit = Math.min(Math.max(rawLimit, 10), 2000);

  const sb = auth.admin;
  // 대상 slug 리스트 — meta_description이 80자 미만인 published 글
  const { data: posts, error: selErr } = await sb.from('blog_posts')
    .select('id, slug, title, category, meta_description')
    .eq('is_published', true)
    .order('view_count', { ascending: false })
    .limit(limit * 3); // 오버-페치 후 클라이언트 필터
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const targets = (posts || []).filter((p: any) => {
    const m = (p.meta_description || '').trim();
    return m.length < 80;
  }).slice(0, limit);

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: 'no targets (all meta_description ≥ 80 chars)' });
  }

  const requests = targets.map((p: any) => ({
    custom_id: `meta-${p.id}`,
    params: {
      model: AI_MODEL_HAIKU,
      max_tokens: 400,
      messages: [{ role: 'user', content: buildPrompt(p.title, p.category, p.meta_description) }],
    },
  }));

  const res = await fetch(ANTHROPIC_BATCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return NextResponse.json({ error: `Anthropic Batch API error: ${res.status}`, detail: errText.slice(0, 500) }, { status: 502 });
  }

  const data = await res.json();
  const batchId = data?.id as string | undefined;
  if (!batchId) return NextResponse.json({ error: 'no batch id in response', detail: data }, { status: 502 });

  // rewrite_batches에 job 기록 (기존 테이블 재활용)
  try {
    await (sb as any).from('rewrite_batches').insert({
      batch_id: batchId,
      status: 'processing',
      category: 'meta_description',
      post_ids: targets.map((p: any) => p.id),
      batch_size: targets.length,
      succeeded: 0,
      failed: 0,
      // 50% 할인 고려: Haiku 4.5 input ~$0.40/1M, output ~$2/1M
      // 프롬프트 ~250 tokens, 출력 ~200 tokens 가정 → request당 ~$0.00052 → 50% 할인
      cost_estimate: Number(((targets.length * 0.00052) / 2).toFixed(4)),
    });
  } catch (err: any) {
    console.warn('[meta-description-batch] rewrite_batches insert failed:', err.message);
  }

  return NextResponse.json({
    ok: true,
    batch_id: batchId,
    count: targets.length,
    estimated_cost_usd: Number(((targets.length * 0.00052) / 2).toFixed(4)),
    discount: '50% (batch API)',
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 });

  const batchId = new URL(req.url).searchParams.get('batch_id');
  if (!batchId) return NextResponse.json({ error: 'batch_id required' }, { status: 400 });

  const res = await fetch(`${ANTHROPIC_BATCH_URL}/${encodeURIComponent(batchId)}`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return NextResponse.json({ error: `Anthropic Batch GET error: ${res.status}`, detail: errText.slice(0, 500) }, { status: 502 });
  }
  const data = await res.json();

  const { data: row } = await auth.admin.from('rewrite_batches').select('*').eq('batch_id', batchId).maybeSingle();
  return NextResponse.json({ ok: true, anthropic: data, row });
}
