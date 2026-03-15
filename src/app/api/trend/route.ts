import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { DEMO_TRENDING } from '@/lib/constants';

export async function GET() {
  // service_role로 RPC 호출 (anon 권한 우회)
  try {
    const admin = await createSupabaseAdmin();
    await admin.rpc('refresh_trending_keywords');
  } catch (_) {}

  try {
    const sb = await createSupabaseServer();
    const { data, error } = await sb
      .from('trending_keywords')
      .select('*')
      .order('rank', { ascending: true })
      .limit(10);
    if (error || !data?.length) return NextResponse.json({ keywords: DEMO_TRENDING });
    return NextResponse.json({ keywords: data });
  } catch {
    return NextResponse.json({ keywords: DEMO_TRENDING });
  }
}