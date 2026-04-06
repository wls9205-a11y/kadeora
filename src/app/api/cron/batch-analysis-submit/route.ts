import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('batch-analysis-submit', async () => {
    const admin = getSupabaseAdmin();
    const { data: active } = await (admin as any).from('rewrite_batches')
      .select('id').in('status', ['submitted', 'processing']).in('category', ['apt-analysis', 'stock-analysis']).limit(1);
    if (active && active.length > 0) return { processed: 0, metadata: { reason: 'batch_in_progress' } };

    const { data: aptSites } = await (admin as any).from('apt_sites')
      .select('id, name, region, sigungu, dong, builder, total_units, move_in_date, price_min, price_max, nearby_station, school_district, transit_score')
      .is('analysis_text', null).eq('is_active', true)
      .order('page_views', { ascending: false, nullsFirst: false }).limit(500);

    let category = 'apt-analysis';
    let items = aptSites || [];

    if (items.length === 0) {
      const { data: stocks } = await (admin as any).from('stock_quotes')
        .select('symbol, name, market, price, change_pct, market_cap, sector, currency, description, per, pbr, dividend_yield, roe')
        .is('analysis_text', null).eq('is_active', true)
        .order('volume', { ascending: false, nullsFirst: false }).limit(500);
      items = stocks || [];
      category = 'stock-analysis';
    }
    if (items.length === 0) return { processed: 0, metadata: { reason: 'all_done' } };

    const requests = items.map((item: any) => {
      if (category === 'apt-analysis') {
        const n = item.name||'', r = item.region||'', b = item.builder||'';
        const pMin = item.price_min ? `${(item.price_min/10000).toFixed(1)}억` : '';
        const pMax = item.price_max ? `${(item.price_max/10000).toFixed(1)}억` : '';
        return { custom_id: `apt-${item.id}`, params: { model: 'claude-haiku-4-5-20251001', max_tokens: 4000, messages: [{ role: 'user', content: `한국 부동산 전문가로서 "${n}" 종합 분석 2000자+.\n데이터: ${r} ${item.sigungu||''} ${item.dong||''}, 시공=${b}, ${item.total_units||'?'}세대, 입주=${item.move_in_date||'미정'}, 분양가=${pMin||pMax||'미공개'}, 역=${item.nearby_station||'-'}, 학군=${item.school_district||'-'}, 교통=${item.transit_score||'-'}/100\n필수5섹션(##): 입지분석, 분양가분석, 청약전략, 입주준비([계산→](/calc) [진단→](/apt/diagnose)), FAQ(### Q. 5개). 마크다운,목차금지,##볼드금지,면책문구.` }] } };
      } else {
        const s = item, isUS = s.currency==='USD';
        const p = isUS ? `$${Number(s.price).toFixed(2)}` : `${Number(s.price).toLocaleString()}원`;
        return { custom_id: `stock-${s.symbol}`, params: { model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: `주식 전문가로서 "${s.name}(${s.symbol})" 분석 1500자+.\n${s.market}, ${p}, 시총=${s.market_cap?(Number(s.market_cap)/1e8).toFixed(0)+'억':'-'}, ${s.sector||'-'}, PER=${s.per||'-'}, PBR=${s.pbr||'-'}, 배당=${s.dividend_yield||'-'}%, ROE=${s.roe||'-'}%\n${(s.description||'').slice(0,200)}\n4섹션: 기업개요, 투자포인트([시세→](/stock)), 밸류에이션, FAQ(### Q.5개). 마크다운,목차금지,면책.` }] } };
      }
    });

    const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ requests }),
    });
    if (!batchRes.ok) { const e = await batchRes.text(); return { processed: 0, metadata: { error: `API ${batchRes.status}`, detail: e.slice(0,200) } }; }

    const bd = await batchRes.json();
    const cost = items.length * (category === 'apt-analysis' ? 0.007 : 0.005);
    await (admin as any).from('rewrite_batches').insert({
      batch_id: bd.id, status: 'submitted', category,
      post_ids: items.map((i: any) => ({ id: i.id||i.symbol, name: i.name })),
      batch_size: items.length, cost_estimate: cost,
    });
    return { processed: items.length, metadata: { batch_id: bd.id, category, cost: `$${cost.toFixed(2)}` } };
  });
  return NextResponse.json(result);
}
