import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 매일 장 마감 후 (15:40 KST) 각 유저 포트폴리오 스냅샷 저장
export const GET = withCronAuth(async (req: NextRequest) => {
  const sb = getSupabaseAdmin();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 포트폴리오 보유 중인 유저 목록
  const { data: users } = await sb.from('portfolio_holdings')
    .select('user_id')
    .limit(1000);

  if (!users?.length) {
    return NextResponse.json({ ok: true, snapshots: 0, message: '보유 유저 없음' });
  }

  const uniqueUsers = [...new Set(users.map(u => u.user_id))];
  let saved = 0;
  let skipped = 0;

  for (const userId of uniqueUsers) {
    try {
      // 이미 오늘 스냅샷이 있으면 스킵
      const { data: existing } = await sb.from('portfolio_snapshots')
        .select('id')
        .eq('user_id', userId)
        .eq('snapshot_date', today)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      // 보유 종목
      const { data: holdings } = await sb.from('portfolio_holdings')
        .select('symbol, buy_price, quantity')
        .eq('user_id', userId);

      if (!holdings?.length) continue;

      // 현재가 조회
      const symbols = holdings.map(h => h.symbol);
      const { data: stocks } = await sb.from('stock_quotes')
        .select('symbol, price')
        .in('symbol', symbols);

      const priceMap = new Map(stocks?.map(s => [s.symbol, s.price]) || []);

      let totalInvested = 0;
      let totalCurrent = 0;

      for (const h of holdings) {
        const cur = priceMap.get(h.symbol) || 0;
        totalInvested += h.buy_price * h.quantity;
        totalCurrent += cur * h.quantity;
      }

      const totalPnl = totalCurrent - totalInvested;
      const pnlPct = totalInvested > 0 ? (totalPnl / totalInvested * 100) : 0;

      await sb.from('portfolio_snapshots').upsert({
        user_id: userId,
        snapshot_date: today,
        total_invested: Math.round(totalInvested),
        total_current: Math.round(totalCurrent),
        total_pnl: Math.round(totalPnl),
        pnl_pct: Math.round(pnlPct * 100) / 100,
        holding_count: holdings.length,
      }, { onConflict: 'user_id,snapshot_date' });

      saved++;
    } catch (e) {
      console.error(`[portfolio-snapshot] user=${userId}`, e);
    }
  }

  console.info(`[portfolio-snapshot] ${saved} saved, ${skipped} skipped, ${uniqueUsers.length} total users`);
  return NextResponse.json({ ok: true, snapshots: saved, skipped, users: uniqueUsers.length });
});
