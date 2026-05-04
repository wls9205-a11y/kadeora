import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';
import { errMsg } from '@/lib/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const campaign_id = searchParams.get('campaign_id') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sb: any = getSupabaseAdmin();

    let q = sb.from('kakao_message_send_logs').select('*', { count: 'exact' });
    if (campaign_id) q = q.eq('campaign_id', campaign_id);
    q = q.order('sent_at', { ascending: false }).range(from, to);
    const { data: rows, count, error } = await q;
    if (error) throw error;

    let q2 = sb.from('kakao_message_send_logs').select('delivery_status');
    if (campaign_id) q2 = q2.eq('campaign_id', campaign_id);
    const { data: statusRows, error: statusErr } = await q2;
    if (statusErr) throw statusErr;

    const by_status: Record<string, number> = {};
    for (const r of statusRows ?? []) {
      const s = (r as any).delivery_status ?? 'unknown';
      by_status[s] = (by_status[s] ?? 0) + 1;
    }

    return NextResponse.json({
      rows: rows ?? [],
      page,
      limit,
      total: count ?? 0,
      by_status,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
