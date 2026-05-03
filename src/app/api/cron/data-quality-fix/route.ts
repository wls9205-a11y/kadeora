import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { getConfig, setConfig } from '@/lib/app-config';

// s223-T4: lowered to 60 — Vercel timeout 발생으로 한 번에 못 끝내고
// app_config(cron_state.data-quality-fix.last_apt_name) 으로 다음 run 이 이어받음.
export const maxDuration = 60;

// s223-T4: halved limit
const PER_RUN_LIMIT = 500;

const CURSOR_NS = 'cron_state';
const CURSOR_KEY = 'data-quality-fix.last_apt_name';

/**
 * 데이터 품질 자동 보정 크론
 * 매주 일요일 05:30 실행
 * apt_complex_profiles의 누락 필드를 apt_transactions 데이터로 자동 채움
 */
export async function GET() {
  const start = Date.now();
  try {
    const result = await withCronLogging('data-quality-fix', async () => {
      const sb = getSupabaseAdmin();
      const stats = { pyeong: 0, jeonseRatio: 0, latestPrice: 0, latestJeonse: 0 };

      // s223-T4: 이전 run 의 마지막 apt_name 부터 이어서 처리
      const cursorCfg = await getConfig(CURSOR_NS, { [CURSOR_KEY.split('.').pop()!]: '' });
      const cursorStart: string = (cursorCfg as any)[CURSOR_KEY.split('.').pop()!] || '';
      let lastName = cursorStart;
      // 60s 안에 못 끝내면 false 로 시작점 유지하고 다음 run 이 이어받게 함.
      let completedFullCycle = false;

      // 1) 평당가 누락 채우기 (apt_transactions 기반)
      try {
        const { data: txns } = await sb.from('apt_transactions')
          .select('apt_name, deal_amount, exclusive_area')
          .gt('deal_amount', 0).gt('exclusive_area', 10)
          .gt('apt_name', cursorStart)
          .gte('deal_date', new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10))
          .order('apt_name', { ascending: true });

        const pyeongMap = new Map<string, number[]>();
        for (const t of (txns || []) as any[]) {
          const pyeong = Math.round((t.deal_amount || 0) / ((t.exclusive_area || 1) / 3.3058));
          if (pyeong > 0 && pyeong < 500000) {
            const arr = pyeongMap.get(t.apt_name) || [];
            arr.push(pyeong);
            pyeongMap.set(t.apt_name, arr);
          }
        }

        let processedNames = 0;
        for (const [name, prices] of pyeongMap) {
          if (Date.now() - start > 50_000) break; // soft preempt
          if (processedNames >= PER_RUN_LIMIT) break;
          if (prices.length < 2) continue;
          const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
          const { error } = await (sb as any).from('apt_complex_profiles')
            .update({ avg_sale_price_pyeong: avg, updated_at: new Date().toISOString() })
            .eq('apt_name', name)
            .or('avg_sale_price_pyeong.is.null,avg_sale_price_pyeong.eq.0');
          if (!error) stats.pyeong++;
          lastName = name;
          processedNames++;
        }
        if (processedNames < PER_RUN_LIMIT) completedFullCycle = true;
      } catch {}

      // 2) 전세가율 누락 계산
      if (Date.now() - start < 50_000) {
        try {
          const { data: missing } = await (sb as any).from('apt_complex_profiles')
            .select('apt_name, latest_sale_price, latest_jeonse_price')
            .gt('latest_sale_price', 0).gt('latest_jeonse_price', 0)
            .or('jeonse_ratio.is.null,jeonse_ratio.eq.0')
            .order('apt_name', { ascending: true })
            .limit(PER_RUN_LIMIT);

          for (const p of (missing || []) as any[]) {
            if (Date.now() - start > 55_000) break;
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
      }

      // 3) latest_sale_price 갱신 (최근 거래가 있는 단지)
      if (Date.now() - start < 55_000) {
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

          let processedLatest = 0;
          for (const [name, price] of latestMap) {
            if (Date.now() - start > 58_000) break;
            if (processedLatest >= PER_RUN_LIMIT) break;
            const { data: existing } = await (sb as any).from('apt_complex_profiles')
              .select('latest_sale_price').eq('apt_name', name).maybeSingle();
            if (existing && (!existing.latest_sale_price || existing.latest_sale_price === 0)) {
              await (sb as any).from('apt_complex_profiles')
                .update({ latest_sale_price: price, updated_at: new Date().toISOString() })
                .eq('apt_name', name);
              stats.latestPrice++;
              processedLatest++;
            }
          }
        } catch {}
      }

      // s223-T4: 한 사이클 다 돌았으면 cursor 리셋, 아니면 다음 run 이 lastName 부터.
      try {
        await setConfig(CURSOR_NS, CURSOR_KEY.split('.').pop()!, completedFullCycle ? '' : lastName);
      } catch { /* cursor write 실패는 비치명 */ }

      return {
        processed: stats.pyeong + stats.jeonseRatio + stats.latestPrice,
        metadata: { ...stats, cursor: completedFullCycle ? '' : lastName, elapsed_ms: Date.now() - start },
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // s223-T4: timeout/exception 시 200 + cron_logs partial 마킹 (cron retry 폭주 방지)
    const elapsed = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const sb = getSupabaseAdmin();
      await (sb as any).from('cron_logs').insert({
        cron_name: 'data-quality-fix',
        status: 'partial',
        started_at: new Date(start).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: elapsed,
        error_message: msg.slice(0, 1000),
        metadata: { reason: 'route_catch', elapsed_ms: elapsed },
      });
    } catch { /* ignore */ }
    return NextResponse.json(
      { ok: false, partial: true, error: msg, elapsed_ms: elapsed },
      { status: 200 },
    );
  }
}
