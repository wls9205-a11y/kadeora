export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error: rpcErr } = await admin.rpc('deactivate_expired_listings');
    if (!rpcErr) return NextResponse.json({ ok: true, deactivated: data || 0 });

    // RPC 없으면 직접 업데이트
    const now = new Date().toISOString();
    const { data: expired } = await admin.from('premium_listings')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('expires_at', now)
      .select('id');

    return NextResponse.json({ ok: true, deactivated: (expired || []).length, fallback: true });
  } catch (e: any) {
    // 에러 시에도 200 반환 (재시도 루프 방지)
    return NextResponse.json({ ok: true, error: e.message });
  }
}
