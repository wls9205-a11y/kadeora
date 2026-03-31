import { NextResponse } from 'next/server';
import { fetchDailyReportData, REPORT_REGIONS } from '@/lib/daily-report-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;
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

  // 5개씩 병렬 배치 (DB 부하 제한 + 타임아웃 방지)
  const BATCH = 5;
  for (let i = 0; i < REPORT_REGIONS.length; i += BATCH) {
    const batch = REPORT_REGIONS.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(async (region) => {
        const data = await fetchDailyReportData(region);
        const { error } = await (sb as any).from('daily_reports').upsert({
          region,
          report_date: dateStr,
          issue_no: data.issueNo,
          data,
        }, { onConflict: 'region,report_date' });
        if (error) throw new Error(error.message);
        return region;
      })
    );
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      const region = batch[j];
      if (r.status === 'fulfilled') {
        results.push({ region, ok: true });
      } else {
        results.push({ region, ok: false, error: (r.reason as Error)?.message || 'unknown' });
      }
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
