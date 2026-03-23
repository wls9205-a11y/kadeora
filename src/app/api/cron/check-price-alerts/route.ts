import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLock } from '@/lib/cron-lock';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 중복 실행 방지 (5분 lock)
  const lockResult = await withCronLock('check-price-alerts', async () => {
    const sb = getSupabaseAdmin();
    let triggered = 0;

    const { data: alerts } = await sb.from('price_alerts')
      .select('*').eq('is_active', true).eq('is_triggered', false);

    if (!alerts?.length) return { checked: 0, triggered: 0 };

    // 주식 알림 처리
    const stockAlerts = alerts.filter((a: any) => a.alert_type?.startsWith('stock'));
    if (stockAlerts.length) {
      const symbols = [...new Set(stockAlerts.map((a: any) => a.target_symbol).filter(Boolean))];
      const { data: stocks } = await sb.from('stock_quotes')
        .select('symbol,name,price,change_pct').in('symbol', symbols as string[]);
      const stockMap = new Map((stocks || []).map((s: any) => [s.symbol, s]));

      for (const alert of stockAlerts) {
        const stock: any = stockMap.get(alert.target_symbol);
        if (!stock) continue;
        let shouldTrigger = false;
        let message = '';

        if (alert.alert_type === 'stock_price') {
          if (alert.condition === 'above' && stock.price >= alert.threshold) {
            shouldTrigger = true;
            message = `${stock.name} 현재가 ${stock.price.toLocaleString()}원이 목표가 ${Number(alert.threshold).toLocaleString()}원 이상 도달`;
          } else if (alert.condition === 'below' && stock.price <= alert.threshold) {
            shouldTrigger = true;
            message = `${stock.name} 현재가 ${stock.price.toLocaleString()}원이 목표가 ${Number(alert.threshold).toLocaleString()}원 이하 도달`;
          }
        } else if (alert.alert_type === 'stock_pct') {
          if (alert.condition === 'change_pct_up' && stock.change_pct >= alert.threshold) {
            shouldTrigger = true;
            message = `${stock.name} 오늘 +${stock.change_pct.toFixed(1)}% 상승 (설정: ${alert.threshold}%)`;
          } else if (alert.condition === 'change_pct_down' && stock.change_pct <= -alert.threshold) {
            shouldTrigger = true;
            message = `${stock.name} 오늘 ${stock.change_pct.toFixed(1)}% 하락 (설정: -${alert.threshold}%)`;
          }
        }

        if (shouldTrigger) {
          await sb.from('price_alerts').update({ is_triggered: true, triggered_at: new Date().toISOString() }).eq('id', alert.id);
          await sb.from('notifications').insert({ user_id: alert.user_id, type: 'price_alert', content: `🔔 ${message}`, link: `/stock/${alert.target_symbol}` });
          triggered++;
        }
      }
    }

    // 청약 D-day 알림
    const aptAlerts = alerts.filter((a: any) => a.alert_type === 'apt_subscription' && a.condition === 'd_day');
    if (aptAlerts.length) {
      const aptIds = aptAlerts.map((a: any) => a.target_apt_id).filter(Boolean);
      const { data: apts } = await sb.from('apt_subscriptions')
        .select('id,house_nm,rcept_bgnde,rcept_endde').in('id', aptIds);
      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      for (const alert of aptAlerts) {
        const apt = (apts || []).find((a: any) => a.id === alert.target_apt_id) as any;
        if (!apt) continue;
        const daysLeft = Math.ceil((new Date(apt.rcept_endde).getTime() - new Date(kstToday).getTime()) / 86400000);
        if (daysLeft === 1 || daysLeft === 3) {
          await sb.from('notifications').insert({ user_id: alert.user_id, type: 'apt_alert', content: `🏠 ${apt.house_nm} 청약 마감 D-${daysLeft}`, link: `/apt/${apt.id}` });
          triggered++;
        }
        if (daysLeft < 0) {
          await sb.from('price_alerts').update({ is_triggered: true, triggered_at: new Date().toISOString() }).eq('id', alert.id);
        }
      }
    }

    return { checked: alerts.length, triggered };
  }, 5);

  if (lockResult.skipped) {
    return NextResponse.json({ skipped: true, reason: lockResult.reason });
  }
  return NextResponse.json({ success: true, ...lockResult.result });
}
