export const maxDuration = 15;
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLock } from '@/lib/cron-lock';
import { sendPushToUsers } from '@/lib/push-utils';

export async function GET(req: Request) {
  try {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 중복 실행 방지 (5분 lock)
  const lockResult = await withCronLock('check-price-alerts', async () => {
    const sb = getSupabaseAdmin();
    let triggered = 0;

    const { data: alerts } = await sb.from('price_alerts')
      .select('id,user_id,alert_type,condition,threshold,target_symbol,target_apt_id,is_active,is_triggered,last_checked_at').eq('is_active', true).eq('is_triggered', false);

    if (!alerts?.length) return { checked: 0, triggered: 0 };

    // 주식 알림 처리
    const stockAlerts = alerts.filter((a: Record<string, any>) => a.alert_type?.startsWith('stock'));
    if (stockAlerts.length) {
      const symbols = [...new Set(stockAlerts.map((a: Record<string, any>) => a.target_symbol).filter(Boolean))];
      const { data: stocks } = await sb.from('stock_quotes')
        .select('symbol,name,price,change_pct').in('symbol', symbols as string[]);
      const stockMap = new Map((stocks || []).map((s: Record<string, any>) => [s.symbol, s]));

      for (const alert of stockAlerts) {
        const stock: any = stockMap.get(alert.target_symbol);
        if (!stock) continue;
        let shouldTrigger = false;
        let message = '';

        if (alert.alert_type === 'stock_price') {
          if (alert.condition === 'above' && stock.price >= (alert.threshold ?? 0)) {
            shouldTrigger = true;
            message = `${stock.name} 현재가 ${stock.price.toLocaleString()}원이 목표가 ${Number(alert.threshold ?? 0).toLocaleString()}원 이상 도달`;
          } else if (alert.condition === 'below' && stock.price <= (alert.threshold ?? 0)) {
            shouldTrigger = true;
            message = `${stock.name} 현재가 ${stock.price.toLocaleString()}원이 목표가 ${Number(alert.threshold ?? 0).toLocaleString()}원 이하 도달`;
          }
        } else if (alert.alert_type === 'stock_pct') {
          if (alert.condition === 'change_pct_up' && stock.change_pct >= (alert.threshold ?? 0)) {
            shouldTrigger = true;
            message = `${stock.name} 오늘 +${stock.change_pct.toFixed(1)}% 상승 (설정: ${alert.threshold}%)`;
          } else if (alert.condition === 'change_pct_down' && stock.change_pct <= -(alert.threshold ?? 0)) {
            shouldTrigger = true;
            message = `${stock.name} 오늘 ${stock.change_pct.toFixed(1)}% 하락 (설정: -${alert.threshold}%)`;
          }
        }

        if (shouldTrigger) {
          await sb.from('price_alerts').update({ is_triggered: true, triggered_at: new Date().toISOString() }).eq('id', alert.id);
          await sb.from('notifications').insert({ user_id: alert.user_id, type: 'price_alert', content: `🔔 ${message}`, link: `/stock/${alert.target_symbol}` });
          sendPushToUsers([alert.user_id], { title: '🔔 종목 알림', body: message, url: `/stock/${alert.target_symbol}`, tag: `price-${alert.id}` }).catch(() => {});
          triggered++;
        }
      }
    }

    // 청약 D-day 알림
    const aptAlerts = alerts.filter((a: Record<string, any>) => a.alert_type === 'apt_subscription' && a.condition === 'd_day');
    if (aptAlerts.length) {
      const aptIds = aptAlerts.map((a: Record<string, any>) => a.target_apt_id).filter(Boolean);
      const { data: apts } = await sb.from('apt_subscriptions')
        .select('id,house_nm,rcept_bgnde,rcept_endde').in('id', aptIds);
      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      for (const alert of aptAlerts) {
        const apt = (apts || []).find((a: Record<string, any>) => a.id === alert.target_apt_id) as Record<string, any>;
        if (!apt) continue;
        const daysLeft = Math.ceil((new Date(apt.rcept_endde).getTime() - new Date(kstToday).getTime()) / 86400000);
        if (daysLeft === 1 || daysLeft === 3) {
          await sb.from('notifications').insert({ user_id: alert.user_id, type: 'apt_alert', content: `🏠 ${apt.house_nm} 청약 마감 D-${daysLeft}`, link: `/apt/${apt.id}` });
          sendPushToUsers([alert.user_id], { title: '🏠 청약 마감 임박', body: `${apt.house_nm} 청약 마감 D-${daysLeft}`, url: '/apt', tag: `apt-alert-${alert.id}` }).catch(() => {});
          triggered++;
        }
        if (daysLeft < 0) {
          await sb.from('price_alerts').update({ is_triggered: true, triggered_at: new Date().toISOString() }).eq('id', alert.id);
        }
      }
    }

    // apt_name 알림 — BlogAptAlertCTA fallback 등록 (실거래 신규 등록 감지)
    // target_symbol = 단지명, condition = 'any_change'
    const aptNameAlerts = alerts.filter((a: Record<string, any>) => a.alert_type === 'apt_name');
    if (aptNameAlerts.length) {
      const aptNames = [...new Set(aptNameAlerts.map((a: Record<string, any>) => a.target_symbol).filter(Boolean))];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      // 최근 24시간 내 실거래 등록된 단지 확인
      const { data: recentTrades } = await (sb as any).from('apt_transactions')
        .select('apt_name, deal_date, deal_amount, exclusive_area')
        .in('apt_name', aptNames)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });
      const recentTradeMap = new Map<string, any>();
      for (const t of (recentTrades || [])) {
        if (!recentTradeMap.has(t.apt_name)) recentTradeMap.set(t.apt_name, t);
      }
      for (const alert of aptNameAlerts) {
        if (!alert.target_symbol) continue;
        const trade = recentTradeMap.get(alert.target_symbol);
        if (!trade) continue;
        const msg = `${alert.target_symbol} 실거래 신규 — ${Math.round(trade.deal_amount / 10000)}억${Math.round(trade.deal_amount % 10000 / 1000) > 0 ? ` ${Math.round(trade.deal_amount % 10000 / 1000)}천` : ''}만원 (${trade.exclusive_area}㎡)`;
        await sb.from('notifications').insert({
          user_id: alert.user_id, type: 'apt_alert', content: `🏠 ${msg}`,
          link: `/apt/complex/${encodeURIComponent(alert.target_symbol)}`,
        });
        sendPushToUsers([alert.user_id], {
          title: '🏠 관심 단지 실거래 등록',
          body: msg,
          url: `/apt/complex/${encodeURIComponent(alert.target_symbol)}`,
          tag: `apt-name-${alert.id}`,
        }).catch(() => {});
        // 알림 발송 후 재사용 가능하도록 is_triggered 리셋하지 않음 (계속 알림)
        await sb.from('price_alerts').update({ last_checked_at: new Date().toISOString() }).eq('id', alert.id);
        triggered++;
      }
    }

    return { checked: alerts.length, triggered };
  }, 5);

  if (lockResult.skipped) {
    return NextResponse.json({ skipped: true, reason: lockResult.reason });
  }
  return NextResponse.json({ success: true, ...lockResult.result });
} catch (e: unknown) {
    console.error('[cron/check-price-alerts]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
