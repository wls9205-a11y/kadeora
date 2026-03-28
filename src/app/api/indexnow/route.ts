import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '3a23def313e1b1283822c54a0f9a5675';

/**
 * IndexNow API — Bing/Yandex 즉시 색인
 * 
 * IndexNow는 URL을 검색엔진에 즉시 알려주는 프로토콜.
 * Bing, Yandex, Seznam, Naver(부분) 지원.
 * 
 * 사용: GET /api/indexnow → 최근 업데이트된 현장 URL을 일괄 제출
 */
async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  // 최근 7일 업데이트된 URL 수집 (4종) — IndexNow 최대한 활용
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [sitesR, blogsR, discussR, stocksR] = await Promise.all([
    sb.from('apt_sites').select('slug')
      .eq('is_active', true).gte('content_score', 25).gte('updated_at', since).limit(100),
    sb.from('blog_posts').select('slug')
      .eq('is_published', true).gte('updated_at', since).limit(100),
    sb.from('discussion_topics').select('id')
      .gte('created_at', since).limit(20),
    sb.from('stock_quotes').select('symbol')
      .eq('is_active', true).gte('updated_at', since).limit(100),
  ]);

  const urls: string[] = [];
  for (const s of sitesR.data || []) urls.push(`${SITE_URL}/apt/${s.slug}`);
  for (const b of blogsR.data || []) urls.push(`${SITE_URL}/blog/${b.slug}`);
  for (const d of discussR.data || []) urls.push(`${SITE_URL}/discuss/${d.id}`);
  for (const s of stocksR.data || []) urls.push(`${SITE_URL}/stock/${s.symbol}`);

  // 정적 중요 페이지도 포함
  urls.push(`${SITE_URL}/apt`);
  urls.push(`${SITE_URL}/blog`);
  urls.push(`${SITE_URL}/stock`);
  urls.push(`${SITE_URL}/feed`);
  urls.push(`${SITE_URL}/discuss`);

  if (urls.length === 0) {
    return NextResponse.json({ submitted: 0, message: 'no updated URLs' });
  }

  // IndexNow 엔드포인트에 일괄 제출
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'kadeora.app',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 100), // IndexNow 최대 100개
      }),
    });

    return NextResponse.json({
      submitted: urls.length,
      status: res.status,
      ok: res.ok,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e), submitted: 0 }, { status: 200 });
  }
}

export const GET = withCronAuth(handler);
