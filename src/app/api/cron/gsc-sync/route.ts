/**
 * 세션 146 A1 — Google Search Console 데이터 일 1회 동기화.
 * 기존 oauth_tokens 테이블의 GSC refresh_token 재사용.
 * 실패/미설정 시에도 200 반환 (아키텍처 룰 #5).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 120;

const SITE_URL = process.env.GSC_SITE_URL || 'https://kadeora.app';

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.access_token || null;
  } catch {
    return null;
  }
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return new NextResponse('ok', { status: 200 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: true, skipped: 'no_google_oauth' });
  }

  const sb = getSupabaseAdmin();
  const { data: token } = await (sb as any)
    .from('oauth_tokens')
    .select('refresh_token')
    .eq('service', 'gsc')
    .maybeSingle();

  if (!token?.refresh_token) {
    return NextResponse.json({ ok: true, skipped: 'no_gsc_refresh_token' });
  }

  const access = await refreshAccessToken(clientId, clientSecret, token.refresh_token);
  if (!access) return NextResponse.json({ ok: true, skipped: 'access_token_refresh_failed' });

  // 3일 전부터 어제까지 (GSC 지연 반영)
  const end = new Date(Date.now() - 2 * 24 * 3600_000).toISOString().slice(0, 10);
  const start = new Date(Date.now() - 5 * 24 * 3600_000).toISOString().slice(0, 10);

  try {
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ['date', 'query', 'page', 'device', 'country'],
        rowLimit: 25000,
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: true, skipped: `gsc_api_${res.status}` });
    }
    const body = await res.json();
    const rows = (body?.rows || []) as any[];

    const batches: any[][] = [];
    for (let i = 0; i < rows.length; i += 500) batches.push(rows.slice(i, i + 500));

    let inserted = 0;
    for (const batch of batches) {
      const payload = batch.map((r) => ({
        date: r.keys[0],
        query: (r.keys[1] || '').slice(0, 300),
        page: (r.keys[2] || '').slice(0, 500),
        device: r.keys[3] || null,
        country: r.keys[4] || null,
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      }));
      const { error } = await (sb as any).from('gsc_search_analytics').insert(payload);
      if (!error) inserted += payload.length;
    }

    return NextResponse.json({ ok: true, date_range: [start, end], rows: rows.length, inserted });
  } catch (e: any) {
    return NextResponse.json({ ok: true, skipped: 'exception', err: String(e?.message || '').slice(0, 120) });
  }
}

export const GET = handler;
export const POST = handler;
