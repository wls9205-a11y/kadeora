import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';
import { submitIndexNow } from '@/lib/indexnow';

/**
 * IndexNow API — Bing/Yandex/Naver 즉시 색인
 * 
 * 최근 7일 업데이트된 URL을 일괄 제출 (최대 500개)
 * 개선: submitIndexNow 라이브러리 사용으로 3개 엔드포인트 동시 전송 + 배치 처리
 */
async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [sitesR, blogsR, discussR, stocksR] = await Promise.all([
    sb.from('apt_sites').select('slug')
      .eq('is_active', true).gte('content_score', 25).gte('updated_at', since).limit(200),
    sb.from('blog_posts').select('slug')
      .eq('is_published', true).gte('updated_at', since).limit(200),
    sb.from('discussion_topics').select('id')
      .gte('created_at', since).limit(50),
    sb.from('stock_quotes').select('symbol')
      .eq('is_active', true).gte('updated_at', since).limit(100),
  ]);

  const urls: string[] = [];
  for (const s of sitesR.data || []) urls.push(`${SITE_URL}/apt/${s.slug}`);
  for (const b of blogsR.data || []) urls.push(`${SITE_URL}/blog/${b.slug}`);
  for (const d of discussR.data || []) urls.push(`${SITE_URL}/discuss/${d.id}`);
  for (const s of stocksR.data || []) urls.push(`${SITE_URL}/stock/${s.symbol}`);

  // 정적 중요 페이지
  urls.push(`${SITE_URL}`, `${SITE_URL}/apt`, `${SITE_URL}/blog`, `${SITE_URL}/stock`, `${SITE_URL}/feed`, `${SITE_URL}/discuss`);

  if (urls.length === 0) {
    return NextResponse.json({ submitted: 0, message: 'no updated URLs' });
  }

  try {
    await submitIndexNow(urls);
    return NextResponse.json({ submitted: urls.length, ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e), submitted: 0 }, { status: 200 });
  }
}

export const GET = withCronAuth(handler);
