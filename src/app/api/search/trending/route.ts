import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const revalidate = 300;

const withTimeout = <T>(p: Promise<T>, ms = 3000): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

export async function GET() {
  try {
    const sb = await createSupabaseServer();

    const logsResult = await withTimeout(sb.rpc('get_trending_searches').limit(8));
    const logs = (logsResult as any)?.data;
    if (logs && logs.length > 0) {
      return NextResponse.json({ keywords: logs });
    }

    const kwResult = await withTimeout(
      sb.from('trending_keywords').select('keyword, heat_score').order('heat_score', { ascending: false }).limit(10)
    );
    const data = (kwResult as any)?.data;
    return NextResponse.json({ keywords: data ?? [] });
  } catch {
    return NextResponse.json({ keywords: [] });
  }
}
