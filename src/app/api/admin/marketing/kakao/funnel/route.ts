import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';
import { errMsg } from '@/lib/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const sb: any = getSupabaseAdmin();
    const { data, error } = await sb.rpc('get_kakao_funnel_summary');
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
