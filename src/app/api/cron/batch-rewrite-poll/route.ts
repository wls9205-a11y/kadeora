import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { anthropicPollFetch } from '@/lib/llm/gateway';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('batch-rewrite-poll', async () => {
    const admin = getSupabaseAdmin();

    // Find active batches
    // ⛔ analysis 배치는 batch-analysis-poll 몫이다. 전에는 category 무구분이라, 팬아웃 순서상
    //    먼저 도는 이 폴러가 apt-analysis 배치를 집어 custom_id 'apt-…' 를 blog id 로 파싱(NaN)하고
    //    배치를 'ended' 로 닫아 버릴 수 있었다 — analysis 결과가 통째로 증발하는 경로.
    const { data: batches } = await (admin as any).from('rewrite_batches')
      .select('*')
      .in('status', ['submitted', 'processing'])
      .not('category', 'in', '(apt-analysis,stock-analysis)')
      .order('created_at', { ascending: true })
      .limit(5);

    if (!batches || batches.length === 0) {
      return { processed: 0, metadata: { reason: 'no_active_batches' } };
    }

    let totalUpdated = 0;

    for (const batch of batches) {
      // Check batch status
      const statusRes = await anthropicPollFetch(`https://api.anthropic.com/v1/messages/batches/${batch.batch_id}`, {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!statusRes.ok) {
        console.error(`[batch-rewrite-poll] Status check failed for ${batch.batch_id}: ${statusRes.status}`);
        continue;
      }

      const statusData = await statusRes.json();

      if (statusData.processing_status === 'in_progress') {
        // Update status to processing if still submitted
        if (batch.status === 'submitted') {
          await (admin as any).from('rewrite_batches')
            .update({ status: 'processing' })
            .eq('id', batch.id);
        }
        continue;
      }

      if (statusData.processing_status !== 'ended') continue;

      // Batch ended — fetch results
      const resultsUrl = statusData.results_url;
      if (!resultsUrl) {
        await (admin as any).from('rewrite_batches')
          .update({ status: 'failed', completed_at: new Date().toISOString(), result_summary: { error: 'no_results_url' } })
          .eq('id', batch.id);
        continue;
      }

      const resultsRes = await fetch(resultsUrl, {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!resultsRes.ok) {
        await (admin as any).from('rewrite_batches')
          .update({ status: 'failed', completed_at: new Date().toISOString(), result_summary: { error: `results_fetch_${resultsRes.status}` } })
          .eq('id', batch.id);
        continue;
      }

      const resultsText = await resultsRes.text();
      const lines = resultsText.trim().split('\n').filter(Boolean);

      let succeeded = 0;
      let failed = 0;
      let truncated = 0;

      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const customId = item.custom_id; // "blog-{id}"
          const postId = parseInt(String(customId ?? '').replace('blog-', ''), 10);
          if (!Number.isFinite(postId)) { failed++; continue; }

          if (item.result?.type === 'succeeded') {
            const newContent = item.result.message?.content?.[0]?.text;
            if (!newContent || newContent.length < 2000) {
              failed++;
              continue;
            }
            // ⛔ 잘린 본문으로 기존 글을 덮어쓰지 않는다(d0d483ee 와 같은 게이트, 수확측).
            if (item.result.message?.stop_reason === 'max_tokens') { truncated++; continue; }

            const clean = newContent.replace(/[#|*\n\r\-\[\]\(\)/]/g, ' ').replace(/\s+/g, ' ').trim();
            const now = new Date().toISOString();

            
            await (admin as any).from('blog_posts').update({
              content: newContent,
              meta_description: clean.slice(0, 120) + ' — 카더라',
              excerpt: clean.slice(0, 150),
              rewritten_at: now,
              updated_at: now,
              content_length: newContent.length,
              quality_checked_at: null, // 품질 재평가 트리거
            }).eq('id', postId);

            succeeded++;
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
        }
      }

      totalUpdated += succeeded;

      // Update batch record
      await (admin as any).from('rewrite_batches').update({
        status: 'ended',
        succeeded,
        failed,
        completed_at: new Date().toISOString(),
        result_summary: {
          total_results: lines.length,
          succeeded,
          failed,
          truncated,
          request_counts: statusData.request_counts,
        },
      }).eq('id', batch.id);

      console.info(`[batch-rewrite-poll] Batch ${batch.batch_id}: ${succeeded} succeeded, ${failed} failed`);
    }

    return { processed: totalUpdated, metadata: { batches_checked: batches.length } };
  });

  return NextResponse.json(result);
}
