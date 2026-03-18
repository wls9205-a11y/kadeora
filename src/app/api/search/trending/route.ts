import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const revalidate = 3600;

export async function GET() {
  try {
    const sb = await createSupabaseServer();

    // 1순위: search_logs 기반 (최근 7일)
    const { data: logs } = await sb.rpc('get_trending_searches').limit(8);
    if (logs && logs.length > 0) {
      return NextResponse.json({ keywords: logs });
    }

    // 2순위: trending_keywords 테이블
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
