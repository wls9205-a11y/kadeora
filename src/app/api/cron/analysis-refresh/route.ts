import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('analysis-refresh', async () => {
    const admin = getSupabaseAdmin();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    // 7일 이상 된 분석 중 인기 현장/종목 5건씩 갱신 대상 표시 (analysis_text = NULL로 리셋)
    const { data: oldApt } = await (admin as any).from('apt_sites')
      .select('id')
      .not('analysis_text', 'is', null)
      .lt('analysis_generated_at', weekAgo)
      .order('page_views', { ascending: false, nullsFirst: false })
      .limit(5);

    let reset = 0;
    if (oldApt?.length) {
      const ids = oldApt.map((a: any) => a.id);
      await (admin as any).from('apt_sites')
        .update({ analysis_text: null, analysis_generated_at: null })
        .in('id', ids);
      reset += ids.length;
    }

    const { data: oldStock } = await (admin as any).from('stock_quotes')
      .select('symbol')
      .not('analysis_text', 'is', null)
      .lt('analysis_generated_at', weekAgo)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(5);

    if (oldStock?.length) {
      const syms = oldStock.map((s: any) => s.symbol);
      await (admin as any).from('stock_quotes')
        .update({ analysis_text: null, analysis_generated_at: null })
        .in('symbol', syms);
      reset += syms.length;
    }

    return { processed: reset, metadata: { apt: oldApt?.length || 0, stock: oldStock?.length || 0 } };
  });
  return NextResponse.json(result);
}
