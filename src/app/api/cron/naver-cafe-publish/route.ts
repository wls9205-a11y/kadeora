import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 네이버 카페 자동 발행 크론
 * 
 * naver_syndication에서 cafe_status='pending' 건을 가져와
 * 네이버 카페 API로 자동 발행
 * 
 * 필요 환경변수:
 * - NAVER_CAFE_ACCESS_TOKEN: OAuth access token
 * - NAVER_CAFE_REFRESH_TOKEN: OAuth refresh token  
 * - NAVER_CLIENT_ID: 네이버 개발자센터 Client ID
 * - NAVER_CLIENT_SECRET: 네이버 개발자센터 Client Secret
 * - NAVER_CAFE_ID: 카페 club ID (숫자)
 * - NAVER_CAFE_MENU_ID: 게시판 메뉴 ID (숫자)
 */

const CAFE_ID = process.env.NAVER_CAFE_ID || '';
const MENU_ID = process.env.NAVER_CAFE_MENU_ID || '';
const BATCH_SIZE = 2; // 하루 2건씩

async function doWork() {
  const accessToken = process.env.NAVER_CAFE_ACCESS_TOKEN;
  
  if (!accessToken || !CAFE_ID || !MENU_ID) {
    return { processed: 0, metadata: { message: 'Naver Cafe API not configured. Set NAVER_CAFE_ACCESS_TOKEN, NAVER_CAFE_ID, NAVER_CAFE_MENU_ID env vars.' } };
  }

  const sb = getSupabaseAdmin();

  // pending 건 가져오기
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

  for (const item of pending) {
    try {
      // 토큰 갱신 시도
      let token = accessToken;
      const refreshToken = process.env.NAVER_CAFE_REFRESH_TOKEN;
      if (refreshToken) {
        try {
          token = await refreshAccessToken(refreshToken) || accessToken;
        } catch { /* use existing token */ }
      }

      // 카페에 글 발행
      const result = await postToCafe(token, item);
      
      await (sb as any).from('naver_syndication')
        .update({ 
          cafe_status: 'published', 
          cafe_article_id: result.articleId,
          published_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      success++;
    } catch (e: any) {
      errors.push(`${item.blog_slug}: ${e.message}`);
      await (sb as any).from('naver_syndication')
        .update({ cafe_status: 'failed' })
        .eq('id', item.id);
    }
  }

  return { processed: success, metadata: { errors, total: pending.length } };
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.NAVER_CAFE_CLIENT_ID || '';
  const clientSecret = process.env.NAVER_CAFE_CLIENT_SECRET || '';
  
  const res = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  return data.access_token || null;
}

async function postToCafe(accessToken: string, item: any): Promise<{ articleId: string }> {
  const url = `https://openapi.naver.com/v1/cafe/${CAFE_ID}/menu/${MENU_ID}/articles`;
  
  // HTML 본문 정리 — 네이버 카페가 허용하는 형식으로
  const cleanHtml = (item.naver_html || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/style="[^"]*"/gi, '')
    .slice(0, 50000); // 네이버 카페 본문 길이 제한

  const body = new URLSearchParams();
  body.append('subject', (item.naver_title || '제목없음').slice(0, 100));
  body.append('content', cleanHtml);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: body.toString(),
  });

  const resText = await res.text();
  
  if (!res.ok) {
    throw new Error(`Cafe API ${res.status}: ${resText.slice(0, 300)}`);
  }

  let data;
  try { data = JSON.parse(resText); } catch { data = {}; }
  return { articleId: data.message?.result?.articleId?.toString() || 'unknown' };
}

export async function GET(req: NextRequest) {
  const result = await withCronLogging('naver-cafe-publish', doWork);
  return NextResponse.json(result);
}
