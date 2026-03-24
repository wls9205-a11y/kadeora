import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

const INDEXNOW_KEY = '3a23def313e1b1283822c54a0f9a5675';

/**
 * IndexNow API — Bing/Yandex 즉시 색인
 * 
 * IndexNow는 URL을 검색엔진에 즉시 알려주는 프로토콜.
 * Bing, Yandex, Seznam, Naver(부분) 지원.
 * 
 * 사용: GET /api/indexnow → 최근 업데이트된 현장 URL을 일괄 제출
 */
async function handler(req: NextRequest) {
  const sb = getSupabaseAdmin();

  // 최근 24시간 내 업데이트된 현장 URL 수집
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: sites } = await sb.from('apt_sites')
    .select('slug')
    .eq('is_active', true)
    .gte('content_score', 40)
    .gte('updated_at', since)
    .limit(100);

  const urls = (sites || []).map((s) => `${SITE_URL}/apt/sites/${s.slug}`);

  // 정적 중요 페이지도 포함
  urls.push(`${SITE_URL}/apt/sites`);
  urls.push(`${SITE_URL}/apt`);

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
  } catch (e: any) {
    return NextResponse.json({ error: e.message, submitted: 0 }, { status: 200 });
  }
}

export const GET = withCronAuth(handler);
