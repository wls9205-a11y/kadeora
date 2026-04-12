import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 2;

async function doWork() {
  // 런타임에서 환경변수 읽기 (cold start 캐시 방지)
  const accessToken = process.env.NAVER_CAFE_ACCESS_TOKEN || '';
  const refreshToken = process.env.NAVER_CAFE_REFRESH_TOKEN || '';
  const clientId = process.env.NAVER_CAFE_CLIENT_ID || '';
  const clientSecret = process.env.NAVER_CAFE_CLIENT_SECRET || '';
  const cafeId = process.env.NAVER_CAFE_ID || '';
  const menuId = process.env.NAVER_CAFE_MENU_ID || '';

  if (!accessToken || !cafeId || !menuId) {
    return { processed: 0, metadata: { message: 'Not configured', hasToken: !!accessToken, cafeId, menuId } };
  }

  // 1단계: 토큰 갱신 시도
  let token = accessToken;
  if (refreshToken && clientId && clientSecret) {
    try {
      const refreshRes = await fetch('https://nid.naver.com/oauth2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        token = refreshData.access_token;
      }
    } catch { /* use original token */ }
  }

  const sb = getSupabaseAdmin();
  const { data: pending } = await (sb as any).from('naver_syndication')
    .select('*')
    .eq('cafe_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (!pending?.length) {
    return { processed: 0, metadata: { message: 'No pending cafe posts' } };
  }

  let success = 0;
  const errors: string[] = [];
  const debug: string[] = [];

  for (const item of pending) {
    try {
      const url = `https://openapi.naver.com/v1/cafe/${cafeId}/menu/${menuId}/articles`;

      // HTML 최소화 — style 제거, script 제거, img 제거 (카페 API가 img를 거부할 수 있음)
      const cleanHtml = (item.naver_html || '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<img[^>]*>/gi, '') // 이미지 태그 제거
        .replace(/style="[^"]*"/gi, '') // 인라인 스타일 제거
        .slice(0, 30000);

      const subject = (item.naver_title || '').replace(/[|~`]/g, '').slice(0, 60);

      const body = new URLSearchParams();
      body.append('subject', subject);
      body.append('content', cleanHtml);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: body.toString(),
      });

      const resText = await res.text();
      debug.push(`${item.id}: status=${res.status}, body=${resText.slice(0, 100)}`);

      if (!res.ok) {
        throw new Error(`${res.status}: ${resText.slice(0, 200)}`);
      }

      let data;
      try { data = JSON.parse(resText); } catch { data = {}; }
      const articleId = data.message?.result?.articleId?.toString() || 'unknown';

      await (sb as any).from('naver_syndication')
        .update({ cafe_status: 'published', cafe_article_id: articleId, published_at: new Date().toISOString() })
        .eq('id', item.id);
      success++;
    } catch (e: any) {
      errors.push(`${item.blog_slug}: ${e.message}`);
      await (sb as any).from('naver_syndication')
        .update({ cafe_status: 'failed' })
        .eq('id', item.id);
    }
  }

  return { processed: success, metadata: { errors, debug, total: pending.length, tokenPrefix: token.slice(0, 10), cafeId, menuId } };
}

export async function GET(req: NextRequest) {
  const result = await withCronLogging('naver-cafe-publish', doWork);
  return NextResponse.json(result);
}
