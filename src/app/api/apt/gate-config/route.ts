import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageType = searchParams.get('page_type');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.rpc('get_apt_gate_config', {
    p_page_type: pageType,
  });
  if (error) return NextResponse.json({ sections: [] }, { status: 200 });
  return NextResponse.json(
    { sections: data ?? [] },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } }
  );
}
