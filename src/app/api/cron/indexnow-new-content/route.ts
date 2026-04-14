import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { SITE_URL } from '@/lib/constants';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '5a7b3c1d2e4f6a8b9c0d1e2f3a4b5c6d';

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('indexnow-new-content', async () => {
    const sb = getSupabaseAdmin();
    const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

    // 최근 6시간 이내 분석 생성된 apt + stock
    const [aptR, stockR, blogR] = await Promise.all([
      (sb as any).from('apt_sites')
        .select('slug')
        .gte('analysis_generated_at', sixHoursAgo)
        .eq('is_active', true)
        .limit(50),
      (sb as any).from('stock_quotes')
        .select('symbol')
        .gte('analysis_generated_at', sixHoursAgo)
        .eq('is_active', true)
        .limit(50),
      sb.from('blog_posts')
        .select('slug')
        .gte('created_at', sixHoursAgo)
        .eq('is_published', true)
        .limit(50),
    ]);

    const urls: string[] = [
      // 정적 페이지 (redev 포함)
      `${SITE_URL}/apt/redev`,
      ...(aptR.data || []).map((a: any) => `${SITE_URL}/apt/${a.slug}`),
      ...(stockR.data || []).map((s: any) => `${SITE_URL}/stock/${s.symbol}`),
      ...(blogR.data || []).map((b: any) => `${SITE_URL}/blog/${b.slug}`),
    ];

    // 지역별 redev 페이지도 주 1회 제출 (월요일만)
    if (new Date().getDay() === 1) {
      const redevRegions = ['서울', '경기', '부산', '인천', '대구', '광주', '대전', '울산', '경남', '경북', '충남', '충북'];
      redevRegions.forEach(r => urls.push(`${SITE_URL}/apt/redev/${encodeURIComponent(r)}`));
    }

    if (urls.length === 0) return { processed: 0, metadata: { reason: 'no_new_content' } };

    const endpoints = [
      'https://api.indexnow.org/indexnow',
      'https://searchadvisor.naver.com/indexnow',
      'https://www.bing.com/indexnow',
    ];

    const payload = {
      host: 'kadeora.app',
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    };

    let submitted = 0;
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (r.ok || r.status === 200 || r.status === 202) submitted++;
      } catch { /* skip */ }
    }

    return { processed: urls.length, metadata: { endpoints: submitted, apt: aptR.data?.length || 0, stock: stockR.data?.length || 0, blog: blogR.data?.length || 0 } };
  });

  return NextResponse.json(result);
}
