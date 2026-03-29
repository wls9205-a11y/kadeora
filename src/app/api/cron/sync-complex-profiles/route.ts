import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

function getAgeGroup(builtYear: number): string {
  const age = 2026 - builtYear;
  if (age <= 3) return '신축';
  if (age <= 8) return '5년차';
  if (age <= 13) return '10년차';
  if (age <= 18) return '15년차';
  if (age <= 23) return '20년차';
  if (age <= 28) return '25년차';
  return '30년+';
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const sb = supabase as any;

  const result = await withCronLogging('sync-complex-profiles', async () => {
    // 1. 매매 거래에서 단지별 집계
    const { data: saleAggs } = await supabase.from('apt_transactions')
      .select('apt_name, region_nm, sigungu, dong, built_year, deal_amount, deal_date, exclusive_area, total_households')
      .order('deal_date', { ascending: false })
      .limit(50000) as { data: any[] | null };

    if (!saleAggs?.length) return { processed: 0, created: 0, failed: 0 };

    // 단지별 매매 집계
    const saleMap = new Map<string, any>();
    for (const t of saleAggs) {
      const key = `${t.apt_name}__${t.sigungu}`;
      if (!saleMap.has(key)) {
        saleMap.set(key, {
          apt_name: t.apt_name, sigungu: t.sigungu, region_nm: t.region_nm,
          dong: t.dong, built_year: t.built_year, total_households: t.total_households,
          latest_sale_price: t.deal_amount, latest_sale_date: t.deal_date,
          sale_prices: [], sale_areas: [],
        });
      }
      const entry = saleMap.get(key)!;
      if (t.deal_amount > 0) {
        entry.sale_prices.push(t.deal_amount);
        if (t.exclusive_area > 0) entry.sale_areas.push(t.exclusive_area);
      }
    }

    // 2. 전월세 거래에서 단지별 집계
    const { data: rentAggs } = await sb.from('apt_rent_transactions')
      .select('apt_name, sigungu, rent_type, deposit, monthly_rent, deal_date, built_year')
      .order('deal_date', { ascending: false })
      .limit(100000);

    const rentMap = new Map<string, any>();
    for (const r of (rentAggs || [])) {
      const key = `${r.apt_name}__${r.sigungu}`;
      if (!rentMap.has(key)) {
        rentMap.set(key, {
          jeonse_prices: [], monthly_deposits: [], monthly_rents: [],
          rent_count: 0, built_year: r.built_year,
        });
      }
      const entry = rentMap.get(key)!;
      entry.rent_count++;
      if (r.rent_type === 'jeonse' && r.deposit > 0) {
        entry.jeonse_prices.push(r.deposit);
      } else if (r.rent_type === 'monthly') {
        if (r.deposit > 0) entry.monthly_deposits.push(r.deposit);
        if (r.monthly_rent > 0) entry.monthly_rents.push(r.monthly_rent);
      }
    }

    // 3. 프로필 생성
    const profiles: any[] = [];
    const allKeys = new Set([...saleMap.keys(), ...rentMap.keys()]);

    for (const key of allKeys) {
      const sale = saleMap.get(key);
      const rent = rentMap.get(key);

      if (!sale && !rent) continue;

      const aptName = sale?.apt_name || key.split('__')[0];
      const sigungu = sale?.sigungu || key.split('__')[1];
      const regionNm = sale?.region_nm || '';
      const builtYear = sale?.built_year || rent?.built_year || null;

      const avgSalePrice = sale?.sale_prices?.length
        ? Math.round(sale.sale_prices.reduce((s: number, a: number) => s + a, 0) / sale.sale_prices.length) : null;

      const avgArea = sale?.sale_areas?.length
        ? sale.sale_areas.reduce((s: number, a: number) => s + a, 0) / sale.sale_areas.length : null;

      const avgPyeong = avgSalePrice && avgArea
        ? Math.round(avgSalePrice / (avgArea / 3.3058)) : null;

      const latestJeonse = rent?.jeonse_prices?.length ? rent.jeonse_prices[0] : null;
      const latestMonthlyDeposit = rent?.monthly_deposits?.length ? rent.monthly_deposits[0] : null;
      const latestMonthlyRent = rent?.monthly_rents?.length ? rent.monthly_rents[0] : null;

      const jeonseRatio = sale?.latest_sale_price && latestJeonse
        ? Math.round((latestJeonse / sale.latest_sale_price) * 100) : null;

      profiles.push({
        apt_name: aptName,
        sigungu,
        region_nm: regionNm,
        dong: sale?.dong || null,
        built_year: builtYear,
        age_group: builtYear ? getAgeGroup(builtYear) : null,
        total_households: sale?.total_households || null,
        latest_sale_price: sale?.latest_sale_price || null,
        latest_sale_date: sale?.latest_sale_date || null,
        avg_sale_price_pyeong: avgPyeong,
        latest_jeonse_price: latestJeonse,
        latest_monthly_deposit: latestMonthlyDeposit,
        latest_monthly_rent: latestMonthlyRent,
        jeonse_ratio: jeonseRatio,
        sale_count_1y: sale?.sale_prices?.length || 0,
        rent_count_1y: rent?.rent_count || 0,
        updated_at: new Date().toISOString(),
      });
    }

    // 4. UPSERT (배치)
    let upserted = 0;
    const BATCH = 500;
    for (let i = 0; i < profiles.length; i += BATCH) {
      const batch = profiles.slice(i, i + BATCH);
      const { error } = await sb.from('apt_complex_profiles')
        .upsert(batch, { onConflict: 'apt_name,sigungu', ignoreDuplicates: false });
      if (!error) upserted += batch.length;
    }

    return {
      processed: allKeys.size,
      created: upserted,
      failed: allKeys.size - upserted,
      metadata: {
        sale_complexes: saleMap.size,
        rent_complexes: rentMap.size,
        total_profiles: profiles.length,
      },
    };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
