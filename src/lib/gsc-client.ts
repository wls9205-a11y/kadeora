/**
 * [GSC-STUB] Google Search Console API 클라이언트 스켈레톤 (세션 139)
 *
 * OAuth 토큰은 public.oauth_tokens (provider='gsc')에 저장.
 * 실제 pull은 /api/cron/gsc-daily-pull (세션 140+) 에서 수행.
 *
 * 이 파일은 OAuth 플로우 + 공통 헬퍼만 제공. 쿼리 샘플 `fetchSamikBeachQuery`도 포함.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';

const PROVIDER = 'gsc';
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';

export interface OAuthToken {
  provider: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string | null;
  client_id: string;
  client_secret: string;
  metadata: Record<string, any> | null;
}

export function buildGscAuthUrl(state: string): string | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${siteOrigin}/api/admin/gsc/oauth`,
    response_type: 'code',
    scope: OAUTH_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthToken | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${siteOrigin}/api/admin/gsc/oauth`,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[gsc-client] exchange failed:', res.status, txt.slice(0, 200));
    return null;
  }
  const data = await res.json();
  const expiresIn = Number(data?.expires_in || 3600);
  const accessExp = new Date(Date.now() + expiresIn * 1000).toISOString();

  return {
    provider: PROVIDER,
    access_token: String(data?.access_token || ''),
    refresh_token: String(data?.refresh_token || ''),
    access_token_expires_at: accessExp,
    client_id: clientId,
    client_secret: clientSecret,
    metadata: { scope: OAUTH_SCOPE },
  };
}

export async function saveGscToken(token: OAuthToken): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const payload = {
    provider: token.provider,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    access_token_expires_at: token.access_token_expires_at,
    client_id: token.client_id,
    client_secret: token.client_secret,
    metadata: token.metadata || {},
    last_refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any;
  const { error } = await (sb as any).from('oauth_tokens').upsert(payload, { onConflict: 'provider' });
  if (error) {
    console.error('[gsc-client] saveGscToken failed:', error);
    return false;
  }
  return true;
}

export async function getValidAccessToken(): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any)
    .from('oauth_tokens')
    .select('*')
    .eq('provider', PROVIDER)
    .maybeSingle();
  if (!data) return null;
  const row = data as OAuthToken;

  // 10분 여유 있으면 그대로 사용
  if (row.access_token_expires_at && new Date(row.access_token_expires_at).getTime() - Date.now() > 10 * 60 * 1000) {
    return row.access_token;
  }

  // refresh
  const body = new URLSearchParams({
    refresh_token: row.refresh_token,
    client_id: row.client_id,
    client_secret: row.client_secret,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const newAccess = String(json?.access_token || '');
  const expiresIn = Number(json?.expires_in || 3600);
  const accessExp = new Date(Date.now() + expiresIn * 1000).toISOString();
  await (sb as any).from('oauth_tokens').update({
    access_token: newAccess,
    access_token_expires_at: accessExp,
    last_refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    refresh_count: (row as any).refresh_count ? (row as any).refresh_count + 1 : 1,
  }).eq('provider', PROVIDER);
  return newAccess;
}

/**
 * 쿼리 샘플: samik-beach-* slug 집계 (세션 140+ daily cron에서 사용 예정)
 */
export async function fetchSamikBeachQuery(): Promise<any> {
  const token = await getValidAccessToken();
  if (!token) return { error: 'no valid token' };
  const siteUrl = process.env.GSC_SITE_URL || 'https://kadeora.app/';
  const startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const endDate = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);

  const res = await fetch(`${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['page', 'query'],
      dimensionFilterGroups: [{
        filters: [{ dimension: 'page', operator: 'contains', expression: 'samik-beach' }],
      }],
      rowLimit: 100,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return { error: `status ${res.status}` };
  return await res.json();
}
