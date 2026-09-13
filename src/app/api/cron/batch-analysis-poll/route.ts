import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { anthropicPollFetch } from '@/lib/llm/gateway';
import { dbw } from '@/lib/cron-db-log';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('batch-analysis-poll', async () => {
    const admin = getSupabaseAdmin();
    const { data: batches } = await (admin as any).from('rewrite_batches')
      .select('*').in('status', ['submitted', 'processing']).in('category', ['apt-analysis', 'stock-analysis'])
      .order('created_at', { ascending: true }).limit(5);
    if (!batches || batches.length === 0) return { processed: 0, metadata: { reason: 'no_active' } };

    let total = 0;
    const summaries: Array<Record<string, unknown>> = [];
    for (const batch of batches) {
      const sr = await anthropicPollFetch(`https://api.anthropic.com/v1/messages/batches/${batch.batch_id}`, {
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(15000),
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
      let ok = 0, fail = 0, truncated = 0, already = 0;
      const now = new Date().toISOString();

      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const text = item.result?.message?.content?.[0]?.text;
          if (item.result?.type !== 'succeeded' || !text || text.length < 400) { fail++; continue; }
          // ⛔ 잘린 글은 저장하지 않는다 — 실시간 크론(d0d483ee)과 같은 게이트를 수확측에도.
          //    이 결과들은 제출 당시 프롬프트(상한 없는 「2,000자+」·4000tok)라 잘림 비율이 높을 수 있다.
          if (item.result?.message?.stop_reason === 'max_tokens') { truncated++; continue; }

          // ⛔ «아직 비어 있는» 행만 채운다. 배치는 제출 후 며칠~몇 주 뒤에 수확될 수 있고
          //    (9/13 실측: 8/29 제출분이 15일 동결), 그 사이 실시간 크론이 새 글을 채운 행을
          //    옛 결과로 덮어쓰면 안 된다.
          if (item.custom_id.startsWith('apt-')) {
            const r = dbw('batch-analysis-poll', 'apt_sites.update', await (admin as any).from('apt_sites')
              .update({ analysis_text: text, analysis_generated_at: now })
              .eq('id', item.custom_id.replace('apt-', '')).is('analysis_text', null).select('id'));
            if ((r.data ?? []).length) ok++; else if (!r.error) already++; else fail++;
          } else if (item.custom_id.startsWith('stock-')) {
            const r = dbw('batch-analysis-poll', 'stock_quotes.update', await (admin as any).from('stock_quotes')
              .update({ analysis_text: text, analysis_generated_at: now })
              .eq('symbol', item.custom_id.replace('stock-', '')).is('analysis_text', null).select('symbol'));
            if ((r.data ?? []).length) ok++; else if (!r.error) already++; else fail++;
          }
        } catch { fail++; }
      }
      total += ok;
      summaries.push({ id: batch.id, status: sd.processing_status, total: lines.length, ok, fail, truncated, already });
      await (admin as any).from('rewrite_batches').update({ status: 'ended', succeeded: ok, failed: fail, completed_at: now, result_summary: { total: lines.length, ok, fail, truncated, already } }).eq('id', batch.id);
    }
    return { processed: total, metadata: { batches: batches.length, summaries } };
  });
  return NextResponse.json(result);
}
