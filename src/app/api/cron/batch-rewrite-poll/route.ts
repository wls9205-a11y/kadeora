import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
    const { data: batches } = await (admin as any).from('rewrite_batches')
      .select('*')
      .in('status', ['submitted', 'processing'])
      .order('created_at', { ascending: true })
      .limit(5);

    if (!batches || batches.length === 0) {
      return { processed: 0, metadata: { reason: 'no_active_batches' } };
    }

    let totalUpdated = 0;

    for (const batch of batches) {
      // Check batch status
      const statusRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${batch.batch_id}`, {
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

      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const customId = item.custom_id; // "blog-{id}"
          const postId = parseInt(customId.replace('blog-', ''), 10);

          if (item.result?.type === 'succeeded') {
            const newContent = item.result.message?.content?.[0]?.text;
            if (!newContent || newContent.length < 2000) {
              failed++;
              continue;
            }

            const clean = newContent.replace(/[#|*\n\r\-\[\]\(\)/]/g, ' ').replace(/\s+/g, ' ').trim();
            const now = new Date().toISOString();

            
            await admin.from('blog_posts').update({
              content: newContent,
              meta_description: clean.slice(0, 120) + ' — 카더라',
              excerpt: clean.slice(0, 150),
              rewritten_at: now,
              updated_at: now,
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
          request_counts: statusData.request_counts,
        },
      }).eq('id', batch.id);

      console.info(`[batch-rewrite-poll] Batch ${batch.batch_id}: ${succeeded} succeeded, ${failed} failed`);
    }

    return { processed: totalUpdated, metadata: { batches_checked: batches.length } };
  });

  return NextResponse.json(result);
}
