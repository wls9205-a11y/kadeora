/**
 * /api/admin/naver-oauth — OAuth 토큰 등록/조회/테스트
 *
 * GET: 현재 등록된 provider 상태 조회
 * POST: provider 토큰 등록/갱신
 * PUT: 강제 refresh 시도
 * DELETE: provider 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { setOAuthToken, getValidAccessToken, listOAuthProviders, deleteOAuthProvider } from '@/lib/naver/oauth-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;

  const provider = req.nextUrl.searchParams.get('provider');
  if (provider) {
    const result = await getValidAccessToken(provider);
    return NextResponse.json({
      provider,
      configured: !!result,
      hasValidToken: !!result?.token,
      meta: result?.meta || null,
      refreshed: result?.refreshed || false,
      warning: result?.warning,
    });
  }

  const all = await listOAuthProviders();
  return NextResponse.json({ providers: all });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { provider, access_token, refresh_token, client_id, client_secret, metadata, expires_in } = body;
  if (!provider || !access_token) {
    return NextResponse.json({ error: 'provider_and_access_token_required' }, { status: 400 });
  }

  const accessTokenExpiresInSec = Number(expires_in) || 3600;

  await setOAuthToken({
    provider,
    access_token,
    refresh_token: refresh_token || undefined,
    client_id: client_id || undefined,
    client_secret: client_secret || undefined,
    metadata: metadata || {},
    expires_in_seconds: accessTokenExpiresInSec,
  });

  return NextResponse.json({ ok: true, provider });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { provider, action } = body;
  if (!provider) return NextResponse.json({ error: 'provider_required' }, { status: 400 });

  if (action === 'refresh') {
    // 강제 갱신
    const result = await getValidAccessToken(provider);
    return NextResponse.json({ ok: !!result, ...result });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const provider = req.nextUrl.searchParams.get('provider');
  if (!provider) return NextResponse.json({ error: 'provider_required' }, { status: 400 });
  await deleteOAuthProvider(provider);
  return NextResponse.json({ ok: true });
}
