import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const sb = getSupabaseAdmin();
  const { count: noImg } = await sb.from('apt_sites')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .or('images.is.null,images.eq.[]');

  const { count: hasImg } = await sb.from('apt_sites')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('images', 'is', null);

  const total = (noImg ?? 0) + (hasImg ?? 0);
  const pct = total > 0 ? ((hasImg ?? 0) / total * 100).toFixed(1) : '0';

  return NextResponse.json({
    has_image: hasImg,
    no_image: noImg,
    total,
    coverage: `${pct}%`,
  });
}
