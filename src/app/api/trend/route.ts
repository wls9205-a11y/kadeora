import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_TRENDING } from '@/lib/constants';

export async function GET() {
  // Auto-refresh trending keywords from recent posts
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await sb.rpc('refresh_trending_keywords');
  } catch (_) {}

  try {
    const sb = await createSupabaseServer();
    const { data, error } = await sb.from('trending_keywords').select('*').order('rank').limit(10);
    if (error || !data?.length) return NextResponse.json({ keywords: DEMO_TRENDING });
    return NextResponse.json({ keywords: data });
  } catch {
    return NextResponse.json({ keywords: DEMO_TRENDING });
  }
}
