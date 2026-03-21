import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const revalidate = 300;

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data, error } = await sb.from('stock_themes')
      .select('*')
      .order('change_pct', { ascending: false })
      .limit(10);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ themes: data || [] });
  } catch { return NextResponse.json({ themes: [] }); }
}
