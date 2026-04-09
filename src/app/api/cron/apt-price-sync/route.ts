import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;

/**
 * 가격 데이터 자동 싱크 크론
 * 
 * apt_sites에 가격이 없는 현장에 대해 3가지 소스에서 자동으로 채움:
 * 1. apt_subscriptions house_type_info → 분양가 min/max
 * 2. apt_transactions → 실거래 min/max  
 * 3. unsold_apts → 미분양 분양가
 * 
 * 스케줄: 매일 1회 (0 3 * * *)
 */

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('apt-price-sync', async () => {
    const sb = getSupabaseAdmin();
    let synced = 0;

    // 1. apt_subscriptions house_type_info → apt_sites (이름 매칭)
    const { data: subsWithPrices } = await sb.from('apt_subscriptions')
      .select('house_nm, house_type_info')
      .not('house_type_info', 'is', null)
      .neq('house_type_info', '[]');
    
    if (subsWithPrices) {
      for (const sub of subsWithPrices) {
        if (!sub.house_nm || !Array.isArray(sub.house_type_info)) continue;
        const prices = sub.house_type_info
          .map((t: any) => t.lttot_top_amount)
          .filter((p: number) => p > 0);
        if (prices.length === 0) continue;

        const pMin = Math.min(...prices);
        const pMax = Math.max(...prices);

        const { data: match } = await sb.from('apt_sites')
          .select('id, price_min')
          .eq('name', sub.house_nm)
          .or('price_min.is.null,price_min.eq.0')
          .limit(1);

        if (match && match.length > 0) {
          await sb.from('apt_sites').update({
            price_min: pMin, price_max: pMax, updated_at: new Date().toISOString(),
          }).eq('id', match[0].id);
          synced++;
        }
      }
    }

    // 2. apt_transactions → apt_sites (이름 매칭)
    const { data: sites } = await sb.from('apt_sites')
      .select('id, name')
      .or('price_min.is.null,price_min.eq.0')
      .eq('is_active', true)
      .limit(200);

    if (sites && sites.length > 0) {
      for (const site of sites) {
        const { data: trades } = await sb.from('apt_transactions')
          .select('deal_amount')
          .eq('apt_name', site.name)
          .gt('deal_amount', 0)
          .limit(50);

        if (trades && trades.length >= 2) {
          const amounts = trades.map(t => t.deal_amount).filter((a): a is number => a != null && a > 0);
          if (amounts.length < 2) continue;
          const pMin = Math.min(...amounts);
          const pMax = Math.max(...amounts);
          await sb.from('apt_sites').update({
            price_min: pMin, price_max: pMax, updated_at: new Date().toISOString(),
          }).eq('id', site.id);
          synced++;
        }
      }
    }

    // 3. unsold_apts → apt_sites
    const { data: unsolds } = await sb.from('unsold_apts')
      .select('house_nm, sale_price_min, sale_price_max')
      .gt('sale_price_min', 0);

    if (unsolds) {
      for (const u of unsolds) {
        if (!u.house_nm) continue;
        const { data: existing } = await sb.from('apt_sites')
          .select('id, price_min')
          .eq('name', u.house_nm)
          .or('price_min.is.null,price_min.eq.0')
          .limit(1);

        if (existing && existing.length > 0) {
          await sb.from('apt_sites').update({
            price_min: u.sale_price_min,
            price_max: u.sale_price_max || u.sale_price_min,
            updated_at: new Date().toISOString(),
          }).eq('id', existing[0].id);
          synced++;
        }
      }
    }

    // 최종 가격 현황 통계
    const { count: total } = await sb.from('apt_sites')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    const { count: hasPrice } = await sb.from('apt_sites')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('price_min', 0);

    return {
      processed: (sites?.length || 0) + (unsolds?.length || 0),
      created: synced,
      updated: synced,
      failed: 0,
      metadata: {
        total_sites: total,
        with_price: hasPrice,
        coverage: total ? `${Math.round(((hasPrice || 0) / total) * 100)}%` : '0%',
      },
    };
  });

  if (!result.success) return NextResponse.json({ ok: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
});
