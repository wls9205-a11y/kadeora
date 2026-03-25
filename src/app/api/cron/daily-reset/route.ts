export const maxDuration = 30;
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    await supabase.rpc('reset_daily_api_usage');

    const today = new Date();
    if (today.getDate() === 1) {
      await supabase.rpc('reset_monthly_api_usage');
    }

    await supabase
      .from('cron_logs')
      .delete()
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    await supabase
      .from('admin_alerts')
      .delete()
      .eq('is_read', true)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    return NextResponse.json({ success: true, message: '일일 리셋 완료' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
