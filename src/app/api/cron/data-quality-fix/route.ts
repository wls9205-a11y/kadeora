import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

/**
 * 데이터 품질 자동 보정 크론
 * 매주 일요일 05:30 실행
 * apt_complex_profiles의 누락 필드를 apt_transactions 데이터로 자동 채움
 */
export async function GET() {
  const result = await withCronLogging('data-quality-fix', async () => {
    const sb = getSupabaseAdmin();
    const stats = { pyeong: 0, jeonseRatio: 0, latestPrice: 0, latestJeonse: 0 };

    // 1) 평당가 누락 채우기 (apt_transactions 기반)
    try {
      const { data: txns } = await sb.from('apt_transactions')
        .select('apt_name, deal_amount, exclusive_area')
        .gt('deal_amount', 0).gt('exclusive_area', 10)
        .gte('deal_date', new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10));

      const pyeongMap = new Map<string, number[]>();
      for (const t of (txns || []) as any[]) {
        const pyeong = Math.round((t.deal_amount || 0) / ((t.exclusive_area || 1) / 3.3058));
        if (pyeong > 0 && pyeong < 500000) {
          const arr = pyeongMap.get(t.apt_name) || [];
          arr.push(pyeong);
          pyeongMap.set(t.apt_name, arr);
        }
      }

      for (const [name, prices] of pyeongMap) {
        if (prices.length < 2) continue;
        const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        const { error } = await (sb as any).from('apt_complex_profiles')
          .update({ avg_sale_price_pyeong: avg, updated_at: new Date().toISOString() })
          .eq('apt_name', name)
          .or('avg_sale_price_pyeong.is.null,avg_sale_price_pyeong.eq.0');
        if (!error) stats.pyeong++;
      }
    } catch {}

    // 2) 전세가율 누락 계산
    try {
      const { data: missing } = await (sb as any).from('apt_complex_profiles')
        .select('apt_name, latest_sale_price, latest_jeonse_price')
        .gt('latest_sale_price', 0).gt('latest_jeonse_price', 0)
        .or('jeonse_ratio.is.null,jeonse_ratio.eq.0')
        .limit(1000);

      for (const p of (missing || []) as any[]) {
        if (p.latest_jeonse_price > p.latest_sale_price) continue;
        const ratio = Math.round(p.latest_jeonse_price / p.latest_sale_price * 1000) / 10;
        if (ratio > 0 && ratio <= 100) {
          await (sb as any).from('apt_complex_profiles')
            .update({ jeonse_ratio: ratio, updated_at: new Date().toISOString() })
            .eq('apt_name', p.apt_name);
          stats.jeonseRatio++;
        }
      }
    } catch {}

    // 3) latest_sale_price 갱신 (최근 거래가 있는 단지)
    try {
      const cutoff = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
      const { data: recent } = await sb.from('apt_transactions')
        .select('apt_name, deal_amount, deal_date')
        .gte('deal_date', cutoff).gt('deal_amount', 0)
        .order('deal_date', { ascending: false });

      const latestMap = new Map<string, number>();
      for (const t of (recent || []) as any[]) {
        if (!latestMap.has(t.apt_name)) latestMap.set(t.apt_name, t.deal_amount);
      }

      for (const [name, price] of latestMap) {
        const { data: existing } = await (sb as any).from('apt_complex_profiles')
          .select('latest_sale_price').eq('apt_name', name).maybeSingle();
        if (existing && (!existing.latest_sale_price || existing.latest_sale_price === 0)) {
          await (sb as any).from('apt_complex_profiles')
            .update({ latest_sale_price: price, updated_at: new Date().toISOString() })
            .eq('apt_name', name);
          stats.latestPrice++;
        }
      }
    } catch {}

    return { processed: stats.pyeong + stats.jeonseRatio + stats.latestPrice, metadata: stats };
  });

  return NextResponse.json({ ok: true, ...result });
}
