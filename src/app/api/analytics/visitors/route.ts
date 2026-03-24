import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [dailyR, weeklyR, monthlyR, allToday, allWeek] = await Promise.all([
      sb.from('page_views').select('visitor_id').gte('created_at', todayStart),
      sb.from('page_views').select('visitor_id').gte('created_at', weekAgo),
      sb.from('page_views').select('visitor_id').gte('created_at', monthAgo),
      sb.from('page_views').select('created_at').gte('created_at', todayStart),
      sb.from('page_views').select('path').gte('created_at', weekAgo),
    ]);

    const distinct = (arr: any[]) => new Set((arr || []).map((r: any) => r.visitor_id)).size;
    const daily = distinct(dailyR.data || []);
    const weekly = distinct(weeklyR.data || []);
    const monthly = distinct(monthlyR.data || []);

    // Top paths
    const pathCounts: Record<string, number> = {};
    (allWeek.data || []).forEach((r: any) => { pathCounts[r.path] = (pathCounts[r.path] || 0) + 1; });
    const topPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([path, count]) => ({ path, count }));

    // Hourly
    const hourCounts: Record<number, number> = {};
    (allToday.data || []).forEach((r: any) => {
      const h = new Date(r.created_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourCounts[i] || 0 }));

    return NextResponse.json({ daily, weekly, monthly, topPaths, hourly });
  } catch {
    return NextResponse.json({ daily: 0, weekly: 0, monthly: 0, topPaths: [], hourly: [] });
  }
}
