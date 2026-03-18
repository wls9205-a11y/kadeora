import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const revalidate = 3600;

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data } = await sb
      .from('trending_keywords')
      .select('keyword, heat_score')
      .order('heat_score', { ascending: false })
      .limit(8);
    return NextResponse.json({ keywords: data ?? [] });
  } catch {
    return NextResponse.json({ keywords: [] });
  }
}
