import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // 관리자 인증
  const sbServer = await createSupabaseServer();
  const { data: { user } } = await sbServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'login required' }, { status: 401 });
  
  const sb = getSupabaseAdmin();
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'admin only' }, { status: 403 });

  // stock-refresh를 CRON_SECRET으로 내부 호출
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });

  try {
    const requestUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${requestUrl.protocol}//${requestUrl.host}`;
    const res = await fetch(`${baseUrl}/api/stock-refresh`, {
      headers: { 'Authorization': `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(290000), // 290초 (maxDuration 300초 이내)
    });
    
    const data = await res.json();
    return NextResponse.json({
      ok: true,
      source: data.source,
      success: data.success,
      failed: data.failed,
      reason: data.reason,
      stockCount: data.stocks?.length || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
