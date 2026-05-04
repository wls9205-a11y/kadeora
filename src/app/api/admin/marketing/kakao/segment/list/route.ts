import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';
import { errMsg } from '@/lib/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const sb: any = getSupabaseAdmin();
    const { data, error } = await sb
      .from('marketing_segments')
      .select('*')
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ segments: data ?? [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
