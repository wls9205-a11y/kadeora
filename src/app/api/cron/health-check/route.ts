export const maxDuration = 15;
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SERVICES = [
  { name: 'supabase', getUrl: () => process.env.NEXT_PUBLIC_SUPABASE_URL! + '/rest/v1/', getHeaders: () => ({ apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }) },
  { name: 'data_go_kr', getUrl: () => 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev', getHeaders: () => ({}) },
  { name: 'seoul_opendata', getUrl: () => 'http://openapi.seoul.go.kr:8088/sample/json/upisRebuild/1/1/', getHeaders: () => ({}) },
  { name: 'molit_stat', getUrl: () => 'http://stat.molit.go.kr/portal/openapi/service/rest/getList.do', getHeaders: () => ({}) },
];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const results: any[] = [];

  for (const service of SERVICES) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(service.getUrl(), {
        method: 'HEAD',
        headers: service.getHeaders(),
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeout);
      const responseTime = Date.now() - start;

      const status = res && res.ok ? 'ok' : res ? 'warning' : 'error';

      await supabase
        .from('health_checks')
        .upsert({
          service_name: service.name,
          status,
          response_time_ms: responseTime,
          last_checked_at: new Date().toISOString(),
          error_message: status !== 'ok' ? `HTTP ${res?.status || 'timeout'}` : null,
        }, { onConflict: 'service_name' });

      results.push({ service: service.name, status, ms: responseTime });

      if (status === 'error') {
        await supabase.from('admin_alerts').insert({
          type: 'api_error',
          severity: 'error',
          title: `서비스 장애: ${service.name}`,
          message: `응답 없음 또는 에러 (${responseTime}ms)`,
        });
      }
    } catch (e: any) {
      const responseTime = Date.now() - start;
      await supabase
        .from('health_checks')
        .upsert({
          service_name: service.name,
          status: 'error',
          response_time_ms: responseTime,
          last_checked_at: new Date().toISOString(),
          error_message: e.message?.substring(0, 200),
        }, { onConflict: 'service_name' });
      results.push({ service: service.name, status: 'error', ms: responseTime });
    }
  }

  await supabase
    .from('health_checks')
    .upsert({
      service_name: 'vercel',
      status: 'ok',
      response_time_ms: 0,
      last_checked_at: new Date().toISOString(),
    }, { onConflict: 'service_name' });

  const { data: quotas } = await supabase.from('api_quotas').select('api_name,daily_used,daily_limit,monthly_used,monthly_limit,last_reset_at');
  for (const q of quotas || []) {
    if (q.daily_limit && (q.daily_used ?? 0) / (q.daily_limit ?? 1) > 0.8) {
      await supabase.from('admin_alerts').insert({
        type: 'quota_warning',
        severity: 'warning',
        title: `API 할당량 80% 초과: ${q.api_name}`,
        message: `일일 ${q.daily_used ?? 0}/${q.daily_limit} 사용`,
      });
    }
  }

  return NextResponse.json({ success: true, results });
}
