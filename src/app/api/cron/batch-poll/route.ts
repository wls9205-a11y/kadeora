/**
 * 세션 147 B3 — Claude Batch API 결과 poll + blog_posts UPDATE.
 *
 * blog_batch_jobs 테이블에서 status='submitted'|'in_progress' row 전부 체크.
 * 완료되면 results 스트리밍 → JSON 파싱 → job_type 에 따라 blog_posts UPDATE.
 *
 * pg_cron 으로 10분마다 호출 (Vercel cron 한도 회피).
 * 아키텍처 룰 #5: 에러여도 200 반환.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

async function fetchBatchStatus(batchId: string) {
  const res = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchBatchResults(resultsUrl: string): Promise<any[]> {
  const res = await fetch(resultsUrl, {
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) return [];
  const text = await res.text();
  return text.split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function extractJsonFromReply(text: string): Record<string, any> | null {
  if (!text) return null;
  // ```json ... ``` 블록 또는 { ... } 직접
  const blockMatch = text.match(/```(?:json)?\s*(\{[\s\S]+?\})\s*```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1]); } catch {}
  }
  const directMatch = text.match(/\{[\s\S]+?\}/);
  if (directMatch) {
    try { return JSON.parse(directMatch[0]); } catch {}
  }
  return null;
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return new NextResponse('ok', { status: 200 });
  if (!ANTHROPIC_KEY) return NextResponse.json({ ok: true, skipped: 'no_anthropic_key' });

  const sb = getSupabaseAdmin();
  const { data: jobs } = await (sb as any)
    .from('blog_batch_jobs')
    .select('id, batch_id, job_type, status, target_count, completed_count')
    .in('status', ['submitted', 'in_progress'])
    .order('submitted_at', { ascending: true });

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ ok: true, polled: 0, message: 'no pending jobs' });
  }

  const summary: any[] = [];

  for (const job of jobs as any[]) {
    const info = await fetchBatchStatus(job.batch_id);
    if (!info) {
      summary.push({ batch_id: job.batch_id, err: 'status_fetch_failed' });
      continue;
    }
    const status: string = info.processing_status || job.status;

    // 상태 업데이트
    await (sb as any).from('blog_batch_jobs').update({ status, result_file_id: info.results_url ? 'ready' : null }).eq('id', job.id);

    if (status !== 'ended' || !info.results_url) {
      summary.push({ batch_id: job.batch_id, status, applied: 0 });
      continue;
    }

    // 결과 적용
    const results = await fetchBatchResults(info.results_url);
    let applied = 0;
    let failed = 0;

    for (const r of results) {
      try {
        const customId: string = r.custom_id || '';
        const [kind, idStr] = customId.split('_');
        const postId = parseInt(idStr, 10);
        if (!postId) continue;

        const message = r.result?.type === 'succeeded' ? r.result.message : null;
        const text = message?.content?.[0]?.text || '';
        const parsed = extractJsonFromReply(text);
        if (!parsed) { failed++; continue; }

        if (job.job_type === 'meta_description' && parsed.meta) {
          await (sb as any).from('blog_posts').update({ meta_description: String(parsed.meta).slice(0, 200) }).eq('id', postId);
          applied++;
        } else if (job.job_type === 'title_rewrite' && parsed.title) {
          await (sb as any).from('blog_posts').update({ title: String(parsed.title).slice(0, 200) }).eq('id', postId);
          applied++;
        } else if (job.job_type === 'apt_narrative' && parsed.narrative) {
          await (sb as any).from('apt_complex_profiles').update({ narrative_text: String(parsed.narrative).slice(0, 5000), narrative_generated_at: new Date().toISOString() }).eq('id', postId);
          applied++;
        } else if (job.job_type === 'faq_ai_generate' && Array.isArray(parsed.faqs)) {
          // metadata.faqs 에 AI 생성 결과 저장 (세션 149 B)
          const { data: existing } = await (sb as any).from('blog_posts').select('metadata').eq('id', postId).maybeSingle();
          const meta = (existing?.metadata && typeof existing.metadata === 'object') ? existing.metadata : {};
          const cleanFaqs = parsed.faqs.filter((f: any) => f?.q && f?.a).slice(0, 5).map((f: any, i: number) => ({ q: String(f.q).slice(0, 300), a: String(f.a).slice(0, 1500), idx: i, source: 'ai' }));
          if (cleanFaqs.length > 0) {
            await (sb as any).from('blog_posts').update({ metadata: { ...meta, faqs: cleanFaqs } }).eq('id', postId);
            applied++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    await (sb as any)
      .from('blog_batch_jobs')
      .update({
        status: 'completed',
        completed_count: applied,
        failed_count: failed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    summary.push({ batch_id: job.batch_id, applied, failed });
  }

  /* ══ A3 병합 — 폴러 5개를 «한 스케줄» 로 ══════════════════════════════════
   *
   * 원래 batch-rewrite-poll · batch-analysis-poll · blog-backfill-poll ·
   * blog-meta-rewrite-poll · batch-poll 이 각자 스케줄을 갖고 있었다.
   * 전부 Anthropic Batch 결과를 기다리는 같은 종류의 일인데 스케줄만 5개였다.
   *
   * ⚠️ 넷의 «로직을 합치지 않았다». 세 테이블(rewrite_batches · blog_image_batch ·
   *    blog_batch_jobs)에 걸친 620줄이라, 합치면 그 자체가 새 버그 면이 된다.
   *    대신 여기서 «불러 준다» — 라우트는 그대로 살아 있고 스케줄만 하나가 된다.
   *    되돌리려면 이 블록만 걷어내고 스케줄 넷을 되살리면 된다.
   *
   * ⚠️ 순차로 부른다. 병렬로 부르면 같은 Anthropic 배치를 넷이 동시에 조회해
   *    레이트리밋에 걸린다. 각자 ms 단위라 순차로도 충분하다.
   * ⚠️ 하나가 실패해도 «나머지를 계속» 부른다. 그리고 실패를 삼키지 않는다.
   */
  const FANOUT = [
    'batch-rewrite-poll',
    'batch-analysis-poll',
    'blog-backfill-poll',
    'blog-meta-rewrite-poll',
  ];
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  const fanout: Record<string, string> = {};
  for (const name of FANOUT) {
    try {
      const r = await fetch(`${base}/api/cron/${name}`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(45000),
      });
      fanout[name] = r.ok ? 'ok' : `http_${r.status}`;
      if (!r.ok) console.error(`[batch-poll] fanout ${name} → ${r.status}`);
    } catch (e: any) {
      fanout[name] = 'error';
      console.error(`[batch-poll] fanout ${name}: ${String(e?.message ?? e).slice(0, 160)}`);
    }
  }

  return NextResponse.json({ ok: true, polled: jobs.length, summary, fanout });
}

export const GET = handler;
export const POST = handler;
