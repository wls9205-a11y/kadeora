import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_TRENDING } from '@/lib/constants';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data, error } = await sb.from('trending_keywords').select('*').order('rank').limit(10);
    if (error || !data?.length) return NextResponse.json({ keywords: DEMO_TRENDING });
    return NextResponse.json({ keywords: data });
  } catch {
    return NextResponse.json({ keywords: DEMO_TRENDING });
  }
}
