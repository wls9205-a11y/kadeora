import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await withCronLogging('apt-price-change', async () => {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('recalc_price_change_1y');
    if (error) {
      console.warn('[apt-price-change] RPC error:', error.message);
      return { processed: 0, created: 0, failed: 1, metadata: { error: error.message } };
    }
    return { processed: data || 0, created: 0, failed: 0, metadata: { note: 'price_change_1y recalculated' } };
  });

  return NextResponse.json({ ok: true, ...result });
}
