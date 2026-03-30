import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('sync-complex-profiles', async () => {
    const sb = getSupabaseAdmin() as any;

    // SQL 함수로 전체 데이터 동기화 (JS 200K 제한 해소 → 전체 250만건 커버)
    try {
      const { data, error } = await sb.rpc('sync_complex_profiles_full');
      if (error) throw new Error(`RPC error: ${error.message}`);

      const stats = data || {};
      const total = (stats.sale_upserted || 0) + (stats.rent_upserted || 0);

      return {
        processed: total,
        created: total,
        failed: 0,
        metadata: stats,
      };
    } catch (err: any) {
      throw new Error(`sync failed: ${err.message}`);
    }
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
