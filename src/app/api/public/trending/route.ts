import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 600;

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('trending_keywords')
    .select('keyword, heat_score, category, rank')
    .order('rank', { ascending: true })
    .limit(15);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
