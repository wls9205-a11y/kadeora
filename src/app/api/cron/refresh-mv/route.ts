export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export const GET = withCronAuth(async (req: NextRequest) => {
  const sb = getSupabaseAdmin();
  try {
    const { error } = await (sb as any).rpc('refresh_apt_overview');
    if (error) throw error;
    return NextResponse.json({ ok: true, refreshed: ['mv_apt_overview', 'mv_unsold_summary'] });
  } catch (err: any) {
    console.error('[refresh-mv]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
});
