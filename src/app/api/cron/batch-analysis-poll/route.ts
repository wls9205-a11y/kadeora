import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('batch-analysis-poll', async () => {
    const admin = getSupabaseAdmin();
    const { data: batches } = await (admin as any).from('rewrite_batches')
      .select('*').in('status', ['submitted', 'processing']).in('category', ['apt-analysis', 'stock-analysis'])
      .order('created_at', { ascending: true }).limit(5);
    if (!batches || batches.length === 0) return { processed: 0, metadata: { reason: 'no_active' } };

    let total = 0;
    for (const batch of batches) {
      const sr = await fetch(`https://api.anthropic.com/v1/messages/batches/${batch.batch_id}`, {
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      });
      if (!sr.ok) continue;
      const sd = await sr.json();

      if (sd.processing_status === 'in_progress') {
        if (batch.status === 'submitted') await (admin as any).from('rewrite_batches').update({ status: 'processing' }).eq('id', batch.id);
        continue;
      }
      if (sd.processing_status !== 'ended' || !sd.results_url) continue;

      const rr = await fetch(sd.results_url, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' } });
      if (!rr.ok) continue;

      const lines = (await rr.text()).trim().split('\n').filter(Boolean);
      let ok = 0, fail = 0;
      const now = new Date().toISOString();

      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const text = item.result?.message?.content?.[0]?.text;
          if (item.result?.type !== 'succeeded' || !text || text.length < 400) { fail++; continue; }

          if (item.custom_id.startsWith('apt-')) {
            await (admin as any).from('apt_sites').update({ analysis_text: text, analysis_generated_at: now }).eq('id', item.custom_id.replace('apt-', ''));
            ok++;
          } else if (item.custom_id.startsWith('stock-')) {
            await (admin as any).from('stock_quotes').update({ analysis_text: text, analysis_generated_at: now }).eq('symbol', item.custom_id.replace('stock-', ''));
            ok++;
          }
        } catch { fail++; }
      }
      total += ok;
      await (admin as any).from('rewrite_batches').update({ status: 'ended', succeeded: ok, failed: fail, completed_at: now, result_summary: { total: lines.length, ok, fail } }).eq('id', batch.id);
    }
    return { processed: total, metadata: { batches: batches.length } };
  });
  return NextResponse.json(result);
}
