export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * KRX 공매도·대차잔고 일일 수집 크론
 * 
 * 데이터 소스: KRX 정보데이터시스템 (data.krx.co.kr)
 * 매일 18:00 KST 실행 권장 (장 마감 후 데이터 확정)
 * 
 * 수집 데이터:
 * 1. 종목별 공매도 거래량/거래대금/비중
 * 2. 공매도 과열 종목 지정 현황
 * 3. 대차잔고 (잔량/잔액/전일대비)
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('krx-short-selling', async () => {
    const supabase = getSupabaseAdmin();
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const todayCompact = today.replace(/-/g, '');

    // ── 1. KRX 공매도 거래현황 ──
    let shortCreated = 0;
    let lendingCreated = 0;
    let failed = 0;

    try {
      // KRX Open API 또는 data.krx.co.kr JSON endpoint
      const shortUrl = `https://data-dbg.krx.co.kr/svc/apis/srt/stk_str_trd_by_stk?basDd=${todayCompact}&strtDd=${todayCompact}&endDd=${todayCompact}`;
      
      const res = await fetch(shortUrl, {
        headers: {
          'AUTH_KEY': process.env.KRX_DATA_API_KEY || '',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        const items = data?.OutBlock_1 || data?.output || [];

        for (const item of items) {
          const symbol = item.ISU_SRT_CD || item.isu_cd;
          if (!symbol) continue;

          const { error } = await (supabase as any).from('short_selling_krx').upsert({
            symbol,
            trade_date: today,
            short_volume: parseInt(item.CVSRTSELL_TRDVOL || item.str_qty || '0'),
            short_amount: parseInt(item.CVSRTSELL_TRDVAL || item.str_amt || '0'),
            short_ratio: parseFloat(item.CVSRTSELL_TRDVAL_WT || item.str_pct || '0'),
          }, { onConflict: 'symbol,trade_date' });

          if (!error) shortCreated++;
          else failed++;
        }
      }
    } catch (e: any) {
      console.error('[krx-short-selling] short data fetch error:', e.message);
      // KRX API 실패 시 — 다른 데이터 소스로 폴백 가능
    }

    // ── 2. 공매도 과열 종목 지정 현황 ──
    try {
      // 과열 종목은 stock_quotes에 is_overheat 플래그로도 관리 가능
      // 여기선 short_selling_krx 테이블에 is_overheat 마킹
      const { data: overheatStocks } = await (supabase as any).from('short_selling_krx')
        .select('symbol')
        .eq('trade_date', today)
        .gte('short_ratio', 20); // 공매도 비중 20% 이상은 과열 후보

      if (overheatStocks?.length) {
        for (const s of overheatStocks) {
          await (supabase as any).from('short_selling_krx')
            .update({ is_overheat: true, overheat_until: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) })
            .eq('symbol', s.symbol)
            .eq('trade_date', today);
        }
      }
    } catch (e: any) {
      console.error('[krx-short-selling] overheat check error:', e.message);
    }

    // ── 3. 대차잔고 ──
    try {
      const lendingUrl = `https://data-dbg.krx.co.kr/svc/apis/srt/stk_str_blnc?basDd=${todayCompact}`;
      
      const res = await fetch(lendingUrl, {
        headers: {
          'AUTH_KEY': process.env.KRX_DATA_API_KEY || '',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        const items = data?.OutBlock_1 || data?.output || [];

        for (const item of items) {
          const symbol = item.ISU_SRT_CD || item.isu_cd;
          if (!symbol) continue;

          const { error } = await (supabase as any).from('lending_balance_krx').upsert({
            symbol,
            trade_date: today,
            balance_shares: parseInt(item.LEND_BAL_QTY || item.bal_qty || '0'),
            balance_amount: parseInt(item.LEND_BAL_AMT || item.bal_amt || '0'),
          }, { onConflict: 'symbol,trade_date' });

          if (!error) lendingCreated++;
          else failed++;
        }
      }
    } catch (e: any) {
      console.error('[krx-short-selling] lending data fetch error:', e.message);
    }

    // ── 4. 전일 대비 변화율 계산 ──
    try {
      const yesterday = new Date(Date.now() + 9 * 3600000 - 86400000).toISOString().slice(0, 10);
      const { data: todayData } = await (supabase as any).from('lending_balance_krx')
        .select('symbol, balance_shares')
        .eq('trade_date', today);
      const { data: yesterdayData } = await (supabase as any).from('lending_balance_krx')
        .select('symbol, balance_shares')
        .eq('trade_date', yesterday);

      if (todayData?.length && yesterdayData?.length) {
        const yMap = new Map(yesterdayData.map((y: any) => [y.symbol, y.balance_shares]));
        for (const t of todayData) {
          const yBal = yMap.get(t.symbol);
          if (yBal && yBal > 0) {
            const change1d = ((t.balance_shares - yBal) / yBal) * 100;
            await (supabase as any).from('lending_balance_krx')
              .update({ change_1d: Math.round(change1d * 100) / 100 })
              .eq('symbol', t.symbol)
              .eq('trade_date', today);
          }
        }
      }
    } catch (e: any) {
      console.error('[krx-short-selling] change calc error:', e.message);
    }

    return {
      processed: shortCreated + lendingCreated,
      created: shortCreated + lendingCreated,
      failed,
      metadata: {
        short_selling_rows: shortCreated,
        lending_balance_rows: lendingCreated,
      },
    };
  });

  return NextResponse.json({ success: true, ...result });
}
