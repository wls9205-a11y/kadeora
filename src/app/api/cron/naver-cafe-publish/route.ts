import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import https from 'https';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 1;

/** ASCII 특수문자만 이스케이프, 한글은 raw UTF-8 바이트 그대로 유지 */
function naverSafeEncode(str: string): string {
  return str
    .replace(/%/g, '%25')
    .replace(/&/g, '%26')
    .replace(/=/g, '%3D')
    .replace(/\+/g, '%2B')
    .replace(/#/g, '%23')
    .replace(/\n/g, '%0A')
    .replace(/\r/g, '%0D');
}

function postToNaverCafe(token: string, cafeId: string, menuId: string, subject: string, content: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 한글은 인코딩 안 함 — raw UTF-8 바이트로 전송
    const postBody = 'subject=' + naverSafeEncode(subject) + '&content=' + naverSafeEncode(content);
    const bodyBuf = Buffer.from(postBody, 'utf8');

    const req = https.request({
      hostname: 'openapi.naver.com',
      path: `/v1/cafe/${cafeId}/menu/${menuId}/articles`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': bodyBuf.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.message?.result?.articleId?.toString() || 'unknown');
          } catch { resolve('unknown'); }
        }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

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
    } catch {}
  }

  const sb = getSupabaseAdmin();
  const { data: pending } = await (sb as any).from('naver_syndication')
    .select('*').eq('cafe_status', 'pending').order('created_at', { ascending: true }).limit(BATCH_SIZE);

  if (!pending?.length) return { processed: 0, metadata: { message: 'No pending' } };

  let success = 0;
  const errors: string[] = [];

  for (const item of pending) {
    try {
      const cleanHtml = (item.naver_html || '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/style="[^"]*"/gi, '')
        .slice(0, 30000);
      const subject = (item.naver_title || '').replace(/[|~`]/g, '').slice(0, 60);

      const articleId = await postToNaverCafe(token, cafeId, menuId, subject, cleanHtml);

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
