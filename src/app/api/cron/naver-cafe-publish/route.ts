import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 1;

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

  let token = accessToken;
  if (refreshToken && clientId && clientSecret) {
    try {
      const r = await fetch('https://nid.naver.com/oauth2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
      });
      const d = await r.json();
      if (d.access_token) token = d.access_token;
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

      // URLSearchParams를 body로 직접 전달 — Content-Type 자동 설정 
      // fetch spec: URLSearchParams body → Content-Type: application/x-www-form-urlencoded;charset=UTF-8
      const params = new URLSearchParams();
      params.append('subject', subject);
      params.append('content', cleanHtml);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: params,
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

export async function GET(req: NextRequest) {
  const result = await withCronLogging('naver-cafe-publish', doWork);
  return NextResponse.json(result);
}
