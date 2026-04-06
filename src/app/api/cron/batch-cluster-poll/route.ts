import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('batch-cluster-poll', async () => {
    const admin = getSupabaseAdmin();
    const API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!API_KEY) return { processed: 0 };

    const { data: batches } = await admin.from('rewrite_batches')
      .select('*').eq('category', 'cluster-blog').in('status', ['submitted', 'processing']);

    if (!batches?.length) return { processed: 0, metadata: { reason: 'no_batches' } };

    let totalSaved = 0;
    for (const batch of batches) {
      const sr = await fetch(`https://api.anthropic.com/v1/messages/batches/${batch.batch_id}`, {
        headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      });
      const sd = await sr.json();

      if (sd.processing_status === 'in_progress') {
        await admin.from('rewrite_batches').update({ status: 'processing' }).eq('id', batch.id);
        continue;
      }
      if (sd.processing_status !== 'ended' || !sd.results_url) continue;

      // 결과 다운로드
      const rr = await fetch(sd.results_url, {
        headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      });
      const lines = (await rr.text()).split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          if (item.result?.type !== 'succeeded') continue;
          const text = item.result.message?.content?.[0]?.text;
          if (!text || text.length < 500) continue;

          const customId = item.custom_id; // apt-cluster:slug or stock-cluster:slug
          const [type, slug] = customId.split(':');

          if (type === 'apt-cluster') {
            const sourceRef = slug.replace(/-(?:subscription-strategy|price-analysis|move-in-cost)$/, '');
            const { data: site } = await (admin as any).from('apt_sites').select('name, region').eq('slug', sourceRef).maybeSingle();
            const title = slug.includes('subscription-strategy') ? `${site?.name || sourceRef} 청약 전략 완전정복`
              : slug.includes('price-analysis') ? `${site?.name || sourceRef} 분양가 분석 주변 시세 비교`
              : `${site?.name || sourceRef} 입주비용 총정리`;

            await safeBlogInsert(admin as any, {
              slug, title, content: text, category: 'apt',
              source_type: 'apt-cluster', source_ref: sourceRef,
              is_published: false, // 발행 큐에서 점진적 발행
            });
            totalSaved++;
          } else if (type === 'stock-cluster') {
            const sourceRef = slug.replace(/-(?:investment-strategy|dividend-analysis|earnings-outlook)$/, '');
            const { data: stock } = await (admin as any).from('stock_quotes').select('name').eq('symbol', sourceRef.toUpperCase()).maybeSingle();
            const title = slug.includes('investment-strategy') ? `${stock?.name || sourceRef} 투자 전략 완전분석`
              : slug.includes('dividend-analysis') ? `${stock?.name || sourceRef} 배당금 분석`
              : `${stock?.name || sourceRef} 실적 전망`;

            await safeBlogInsert(admin as any, {
              slug, title, content: text, category: 'stock',
              source_type: 'stock-cluster', source_ref: sourceRef.toUpperCase(),
              is_published: false,
            });
            totalSaved++;
          }
        } catch {}
      }

      await admin.from('rewrite_batches').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', batch.id);
    }

    return { processed: totalSaved, metadata: { batches: batches.length } };
  });
  return NextResponse.json(result);
}
