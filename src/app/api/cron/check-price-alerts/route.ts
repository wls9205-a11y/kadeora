import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = supabase();
  const start = Date.now();
  let triggered = 0;

  try {
    // 활성 알림 가져오기
    const { data: alerts } = await sb.from('price_alerts')
      .select('*')
      .eq('is_active', true)
      .eq('is_triggered', false);

    if (!alerts?.length) {
      return NextResponse.json({ triggered: 0, message: 'No active alerts' });
    }

    // 주식 알림 처리
    const stockAlerts = alerts.filter(a => a.alert_type?.startsWith('stock'));
    if (stockAlerts.length) {
      const symbols = [...new Set(stockAlerts.map(a => a.target_symbol).filter(Boolean))];
      const { data: stocks } = await sb.from('stock_quotes')
        .select('symbol,name,price,change_pct')
        .in('symbol', symbols);

      const stockMap = new Map(stocks?.map(s => [s.symbol, s]) || []);

      for (const alert of stockAlerts) {
        const stock = stockMap.get(alert.target_symbol);
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
          const absPct = Math.abs(stock.change_pct);
          if (alert.condition === 'change_pct_up' && stock.change_pct >= alert.threshold) {
            shouldTrigger = true;
            message = `${stock.name} 오늘 +${stock.change_pct.toFixed(1)}% 상승 (설정: ${alert.threshold}%)`;
          } else if (alert.condition === 'change_pct_down' && stock.change_pct <= -alert.threshold) {
            shouldTrigger = true;
            message = `${stock.name} 오늘 ${stock.change_pct.toFixed(1)}% 하락 (설정: -${alert.threshold}%)`;
          }
        }

        if (shouldTrigger) {
          // 알림 트리거 처리
          await sb.from('price_alerts').update({
            is_triggered: true, triggered_at: new Date().toISOString(),
          }).eq('id', alert.id);

          // 푸시 알림 생성
          await sb.from('notifications').insert({
            user_id: alert.user_id,
            type: 'price_alert',
            content: `🔔 ${message}`,
            link: `/stock/${alert.target_symbol}`,
          });

          triggered++;
        }
      }
    }

    // 청약 D-day 알림 처리
    const aptAlerts = alerts.filter(a => a.alert_type === 'apt_subscription' && a.condition === 'd_day');
    if (aptAlerts.length) {
      const aptIds = aptAlerts.map(a => a.target_apt_id).filter(Boolean);
      const { data: apts } = await sb.from('apt_subscriptions')
        .select('id,house_nm,rcept_bgnde,rcept_endde')
        .in('id', aptIds);

      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      for (const alert of aptAlerts) {
        const apt = apts?.find(a => a.id === alert.target_apt_id);
        if (!apt) continue;

        const daysLeft = Math.ceil((new Date(apt.rcept_endde).getTime() - new Date(kstToday).getTime()) / 86400000);
        
        if (daysLeft === 1 || daysLeft === 3) {
          await sb.from('notifications').insert({
            user_id: alert.user_id,
            type: 'apt_alert',
            content: `🏠 ${apt.house_nm} 청약 마감 D-${daysLeft}`,
            link: `/apt/${apt.id}`,
          });
          triggered++;
        }

        if (daysLeft < 0) {
          await sb.from('price_alerts').update({ is_triggered: true, triggered_at: new Date().toISOString() })
            .eq('id', alert.id);
        }
      }
    }

    // 크론 로그
    await sb.from('cron_logs').insert({
      cron_name: 'check-price-alerts',
      status: 'success',
      duration_ms: Date.now() - start,
      records_processed: alerts.length,
      records_created: triggered,
    });

    return NextResponse.json({ success: true, checked: alerts.length, triggered });
  } catch (error: any) {
    await sb.from('cron_logs').insert({
      cron_name: 'check-price-alerts',
      status: 'failed',
      duration_ms: Date.now() - start,
      error_message: error.message?.substring(0, 500),
    });
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}
