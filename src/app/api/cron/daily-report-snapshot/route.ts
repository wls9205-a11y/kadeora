import { NextResponse } from 'next/server';
import { fetchDailyReportData, REPORT_REGIONS } from '@/lib/daily-report-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const results: { region: string; ok: boolean; error?: string }[] = [];

  // 17개 지역 순차 처리 (병렬하면 DB 부하)
  for (const region of REPORT_REGIONS) {
    try {
      const data = await fetchDailyReportData(region);
      const { error } = await (sb as any).from('daily_reports').upsert({
        region,
        report_date: dateStr,
        issue_no: data.issueNo,
        data,
      }, { onConflict: 'region,report_date' });

      if (error) {
        results.push({ region, ok: false, error: error.message });
      } else {
        results.push({ region, ok: true });
      }
    } catch (e: any) {
      results.push({ region, ok: false, error: e?.message || 'unknown' });
    }
  }

  const succeeded = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return NextResponse.json({
    date: dateStr,
    total: REPORT_REGIONS.length,
    succeeded,
    failed,
    results,
  }, { status: 200 });
}
