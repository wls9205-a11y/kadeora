import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import iconv from 'iconv-lite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 1; // 네이버 카페 API 속도 제한 — 1건씩 처리

async function doWork() {
  const accessToken = process.env.NAVER_CAFE_ACCESS_TOKEN || '';
  const refreshToken = process.env.NAVER_CAFE_REFRESH_TOKEN || '';
  const clientId = process.env.NAVER_CAFE_CLIENT_ID || '';
  const clientSecret = process.env.NAVER_CAFE_CLIENT_SECRET || '';
  const cafeId = process.env.NAVER_CAFE_ID || '';
  const menuId = process.env.NAVER_CAFE_MENU_ID || '';

  if (!accessToken || !cafeId || !menuId) {
    return { processed: 0, metadata: { message: 'Not configured' } };
  }

  // 토큰 갱신
  let token = accessToken;
  if (refreshToken && clientId && clientSecret) {
    try {
      const refreshRes = await fetch('https://nid.naver.com/oauth2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) token = refreshData.access_token;
    } catch { /* use original */ }
  }

  const sb = getSupabaseAdmin();
  const { data: pending } = await (sb as any).from('naver_syndication')
    .select('*').eq('cafe_status', 'pending').order('created_at', { ascending: true }).limit(BATCH_SIZE);

  if (!pending?.length) return { processed: 0, metadata: { message: 'No pending' } };

  let success = 0;
  const errors: string[] = [];

  for (const item of pending) {
    try {
      const url = `https://openapi.naver.com/v1/cafe/${cafeId}/menu/${menuId}/articles`;
      const cleanHtml = (item.naver_html || '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/style="[^"]*"/gi, '')
        .slice(0, 30000);
      const subject = (item.naver_title || '').replace(/[|~`]/g, '').slice(0, 60);

      // EUC-KR로 인코딩하여 전송 (네이버 카페 API는 EUC-KR 기반)
      const subjectEncoded = eucKrEncode(subject);
      const contentEncoded = eucKrEncode(cleanHtml);
      const bodyStr = `subject=${subjectEncoded}&content=${contentEncoded}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyStr,
      });

      const resText = await res.text();
      if (!res.ok) throw new Error(`${res.status}: ${resText.slice(0, 200)}`);

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

  return { processed: success, metadata: { errors, total: pending.length } };
}

/** 한글 문자열을 EUC-KR 퍼센트 인코딩으로 변환 */
function eucKrEncode(str: string): string {
  const buf = iconv.encode(str, 'euc-kr');
  let result = '';
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    // 알파벳, 숫자, 일부 특수문자는 그대로
    if ((byte >= 0x41 && byte <= 0x5A) || (byte >= 0x61 && byte <= 0x7A) ||
        (byte >= 0x30 && byte <= 0x39) || byte === 0x2D || byte === 0x5F ||
        byte === 0x2E || byte === 0x21 || byte === 0x7E || byte === 0x2A ||
        byte === 0x27 || byte === 0x28 || byte === 0x29) {
      result += String.fromCharCode(byte);
    } else if (byte === 0x20) {
      result += '+';
    } else {
      result += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return result;
}

export async function GET(req: NextRequest) {
  const result = await withCronLogging('naver-cafe-publish', doWork);
  return NextResponse.json(result);
}
