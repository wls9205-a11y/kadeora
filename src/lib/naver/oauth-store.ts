/**
 * Naver OAuth 토큰 통합 저장소
 * 
 * 환경변수 직접 읽지 마라. 무조건 이 모듈 통해서.
 * Refresh token rotation 자동 처리 → 1년 후 정지 사고 영구 방지
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';

export interface OAuthRecord {
  provider: string;
  access_token: string;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  client_id: string | null;
  client_secret: string | null;
  metadata: Record<string, any>;
  last_refreshed_at: string | null;
  refresh_count: number;
  last_error: string | null;
}

interface ValidTokenResult {
  token: string;
  meta: Record<string, any>;
  refreshed: boolean;
  warning?: string;
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 만료 5분 전부터 갱신

/**
 * 유효한 access token 가져오기 (필요 시 refresh)
 * 어떤 provider 든 동일한 인터페이스
 */
export async function getValidAccessToken(provider: string): Promise<ValidTokenResult | null> {
  const sb = getSupabaseAdmin();
  const { data: rec } = await (sb as any)
    .from('oauth_tokens')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();

  if (!rec) return null;

  const now = Date.now();
  const expiresAt = rec.access_token_expires_at ? new Date(rec.access_token_expires_at).getTime() : 0;
  const needsRefresh = !expiresAt || (expiresAt - now < REFRESH_BUFFER_MS);

  if (!needsRefresh) {
    return { token: rec.access_token, meta: rec.metadata || {}, refreshed: false };
  }

  // refresh 시도
  if (!rec.refresh_token || !rec.client_id || !rec.client_secret) {
    return {
      token: rec.access_token,
      meta: rec.metadata || {},
      refreshed: false,
      warning: 'refresh_credentials_missing',
    };
  }

  const refreshed = await refreshNaverToken(rec, sb);
  return refreshed;
}

async function refreshNaverToken(rec: OAuthRecord, sb: any): Promise<ValidTokenResult> {
  try {
    const r = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: rec.client_id || '',
        client_secret: rec.client_secret || '',
        refresh_token: rec.refresh_token || '',
      }).toString(),
    });

    const d = await r.json();
    if (!d.access_token) {
      // 실패 → 마지막 에러만 기록하고 기존 토큰 반환
      await (sb as any).from('oauth_tokens').update({
        last_error: JSON.stringify(d).slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq('provider', rec.provider);
      return {
        token: rec.access_token,
        meta: rec.metadata || {},
        refreshed: false,
        warning: 'refresh_failed: ' + (d.error_description || d.error || 'unknown'),
      };
    }

    const newExpiresAt = new Date(Date.now() + (Number(d.expires_in) || 3600) * 1000).toISOString();
    const updates: Partial<OAuthRecord> = {
      access_token: d.access_token,
      access_token_expires_at: newExpiresAt,
      last_refreshed_at: new Date().toISOString(),
      refresh_count: (rec.refresh_count || 0) + 1,
      last_error: null,
    };

    // Naver는 refresh 시 새 refresh_token도 줄 수 있음 → DB에 영구 저장 (rotation)
    if (d.refresh_token && d.refresh_token !== rec.refresh_token) {
      updates.refresh_token = d.refresh_token;
      updates.refresh_token_expires_at = new Date(Date.now() + 365 * 86400 * 1000).toISOString();
    }

    await (sb as any).from('oauth_tokens').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('provider', rec.provider);

    return {
      token: d.access_token,
      meta: rec.metadata || {},
      refreshed: true,
    };
  } catch (e: any) {
    await (sb as any).from('oauth_tokens').update({
      last_error: (e?.message || String(e)).slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq('provider', rec.provider);
    return {
      token: rec.access_token,
      meta: rec.metadata || {},
      refreshed: false,
      warning: 'exception: ' + e?.message,
    };
  }
}

/**
 * 신규 OAuth 토큰 등록 (어드민 UI에서 호출)
 */
export async function setOAuthToken(input: {
  provider: string;
  access_token: string;
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
  metadata?: Record<string, any>;
  expires_in_seconds?: number;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  const expiresIn = input.expires_in_seconds || 3600;
  await (sb as any).from('oauth_tokens').upsert({
    provider: input.provider,
    access_token: input.access_token,
    refresh_token: input.refresh_token || null,
    access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    refresh_token_expires_at: input.refresh_token
      ? new Date(Date.now() + 365 * 86400 * 1000).toISOString()
      : null,
    client_id: input.client_id || null,
    client_secret: input.client_secret || null,
    metadata: input.metadata || {},
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider' });
}

/**
 * OAuth 상태 조회 (어드민 대시보드용)
 */
export async function getOAuthStatus(provider: string): Promise<{
  configured: boolean;
  hasRefreshToken: boolean;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  daysUntilRefreshExpiry: number | null;
  lastRefreshedAt: string | null;
  refreshCount: number;
  lastError: string | null;
  metadata: Record<string, any>;
}> {
  const sb = getSupabaseAdmin();
  const { data: rec } = await (sb as any)
    .from('oauth_tokens')
    .select('access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, last_refreshed_at, refresh_count, last_error, metadata')
    .eq('provider', provider)
    .maybeSingle();

  if (!rec) {
    return {
      configured: false, hasRefreshToken: false,
      accessTokenExpiresAt: null, refreshTokenExpiresAt: null,
      daysUntilRefreshExpiry: null, lastRefreshedAt: null,
      refreshCount: 0, lastError: null, metadata: {},
    };
  }

  const refreshExpiresAt = rec.refresh_token_expires_at ? new Date(rec.refresh_token_expires_at) : null;
  const daysUntil = refreshExpiresAt
    ? Math.floor((refreshExpiresAt.getTime() - Date.now()) / (86400 * 1000))
    : null;

  return {
    configured: !!rec.access_token,
    hasRefreshToken: !!rec.refresh_token,
    accessTokenExpiresAt: rec.access_token_expires_at,
    refreshTokenExpiresAt: rec.refresh_token_expires_at,
    daysUntilRefreshExpiry: daysUntil,
    lastRefreshedAt: rec.last_refreshed_at,
    refreshCount: rec.refresh_count || 0,
    lastError: rec.last_error,
    metadata: rec.metadata || {},
  };
}

/**
 * 모든 OAuth 등록 provider 조회 (어드민 대시보드용)
 */
export async function listOAuthProviders(): Promise<Array<{
  provider: string;
  configured: boolean;
  hasRefreshToken: boolean;
  refreshCount: number;
  daysUntilRefreshExpiry: number | null;
  lastRefreshedAt: string | null;
  lastError: string | null;
  metadata: Record<string, any>;
}>> {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any)
    .from('oauth_tokens')
    .select('provider, access_token, refresh_token, refresh_token_expires_at, last_refreshed_at, refresh_count, last_error, metadata')
    .order('provider');

  return (data || []).map((rec: any) => {
    const refreshExpiresAt = rec.refresh_token_expires_at ? new Date(rec.refresh_token_expires_at) : null;
    const daysUntil = refreshExpiresAt
      ? Math.floor((refreshExpiresAt.getTime() - Date.now()) / (86400 * 1000))
      : null;
    return {
      provider: rec.provider,
      configured: !!rec.access_token,
      hasRefreshToken: !!rec.refresh_token,
      refreshCount: rec.refresh_count || 0,
      daysUntilRefreshExpiry: daysUntil,
      lastRefreshedAt: rec.last_refreshed_at,
      lastError: rec.last_error,
      metadata: rec.metadata || {},
    };
  });
}

/**
 * OAuth provider 삭제 (어드민 UI에서 호출)
 */
export async function deleteOAuthProvider(provider: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await (sb as any).from('oauth_tokens').delete().eq('provider', provider);
}
