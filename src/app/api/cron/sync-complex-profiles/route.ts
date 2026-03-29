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
    // 1. 매매 집계 — 최근 200K 거래 (메모리 제한 고려)
    const { data: saleData } = await supabase.from('apt_transactions')
      .select('apt_name, region_nm, sigungu, dong, built_year, deal_amount, deal_date, exclusive_area')
      .gt('deal_amount', 0)
      .order('deal_date', { ascending: false })
      .limit(200000) as { data: any[] | null };

    const saleMap = new Map<string, any>();
    for (const t of (saleData || [])) {
      const key = `${t.apt_name}__${t.sigungu}`;
      if (!saleMap.has(key)) {
        saleMap.set(key, {
          apt_name: t.apt_name, sigungu: t.sigungu, region_nm: t.region_nm,
          dong: t.dong, built_year: t.built_year,
          latest_sale_price: t.deal_amount, latest_sale_date: t.deal_date,
          prices: [] as number[], areas: [] as number[],
        });
      }
      const e = saleMap.get(key)!;
      e.prices.push(t.deal_amount);
      if (t.exclusive_area > 0) e.areas.push(t.exclusive_area);
    }

    // 2. 전월세 집계 — 최근 500K 거래
    const { data: rentData } = await sb.from('apt_rent_transactions')
      .select('apt_name, sigungu, rent_type, deposit, monthly_rent, built_year')
      .gt('deposit', 0)
      .order('deal_date', { ascending: false })
      .limit(500000);

    const rentMap = new Map<string, any>();
    for (const r of (rentData || [])) {
      const key = `${r.apt_name}__${r.sigungu}`;
      if (!rentMap.has(key)) {
        rentMap.set(key, { jeonse: 0, mDeposit: 0, mRent: 0, cnt: 0, built_year: r.built_year });
      }
      const e = rentMap.get(key)!;
      e.cnt++;
      if (r.rent_type === 'jeonse' && r.deposit > e.jeonse) e.jeonse = r.deposit;
      if (r.rent_type === 'monthly') {
        if (r.deposit > e.mDeposit) e.mDeposit = r.deposit;
        if (r.monthly_rent > e.mRent) e.mRent = r.monthly_rent;
      }
    }

    // 3. 프로필 생성
    const allKeys = new Set([...saleMap.keys(), ...rentMap.keys()]);
    const profiles: any[] = [];

    for (const key of allKeys) {
      const s = saleMap.get(key);
      const r = rentMap.get(key);
      const aptName = s?.apt_name || key.split('__')[0];
      const sigungu = s?.sigungu || key.split('__')[1];
      const builtYear = s?.built_year || r?.built_year || null;

      const avgPrice = s?.prices?.length ? Math.round(s.prices.reduce((a: number, b: number) => a + b, 0) / s.prices.length) : null;
      const avgArea = s?.areas?.length ? s.areas.reduce((a: number, b: number) => a + b, 0) / s.areas.length : null;
      const avgPyeong = avgPrice && avgArea ? Math.round(avgPrice / (avgArea / 3.3058)) : null;
      const jeonseRatio = s?.latest_sale_price && r?.jeonse ? Math.round((r.jeonse / s.latest_sale_price) * 100) : null;

      profiles.push({
        apt_name: aptName, sigungu, region_nm: s?.region_nm || '',
        dong: s?.dong || null, built_year: builtYear,
        age_group: builtYear ? getAgeGroup(builtYear) : null,
        latest_sale_price: s?.latest_sale_price || null,
        latest_sale_date: s?.latest_sale_date || null,
        avg_sale_price_pyeong: avgPyeong,
        latest_jeonse_price: r?.jeonse || null,
        latest_monthly_deposit: r?.mDeposit || null,
        latest_monthly_rent: r?.mRent || null,
        jeonse_ratio: jeonseRatio,
        sale_count_1y: s?.prices?.length || 0,
        rent_count_1y: r?.cnt || 0,
        updated_at: new Date().toISOString(),
      });
    }

    // 4. UPSERT 배치
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
      metadata: { sale_complexes: saleMap.size, rent_complexes: rentMap.size, total_profiles: profiles.length },
    };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
