export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const BATCH_SIZE = 25;

async function fetchTrend(keyword: string): Promise<{ period: string; ratio: number }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate, endDate, timeUnit: 'week',
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results?.[0]?.data || []).map((d: Record<string, any>) => ({ period: d.period, ratio: d.ratio }));
  } catch { return []; }
}

async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let collected = 0;

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ error: 'NAVER API keys not set' }, { status: 200 });
  }

  const { data: sites } = await sb.from('apt_sites')
    .select('id, name, search_trend')
    .eq('is_active', true).gte('content_score', 40)
    .order('interest_count', { ascending: false })
    .limit(BATCH_SIZE * 3);

  const targets = (sites || []).filter((s: Record<string, any>) => {
    if (!s.search_trend) return true;
    const lastUpdated = (s.search_trend as any)?.updated_at;
    if (!lastUpdated) return true;
    return Date.now() - new Date(lastUpdated).getTime() > 7 * 24 * 60 * 60 * 1000;
  }).slice(0, BATCH_SIZE);

  for (const site of targets) {
    try {
      const trend = await fetchTrend(site.name);
      if (trend.length === 0) continue;
      await sb.from('apt_sites').update({
        search_trend: { data: trend, updated_at: new Date().toISOString(), keyword: site.name },
        updated_at: new Date().toISOString(),
      }).eq('id', site.id);
      collected++;
      await new Promise(r => setTimeout(r, 200));
    } catch {}
  }

  return NextResponse.json({ success: true, collected, total_checked: targets.length, elapsed: `${Date.now() - start}ms` });
}

export const GET = withCronAuth(handler);
