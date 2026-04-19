/**
 * [GSC-STUB] Google Search Console OAuth 플로우 (세션 139)
 *
 * GET (쿼리 없음): 최초 승인 URL 생성 후 리다이렉트
 * GET ?code=...&state=...: callback — 토큰 교환 후 oauth_tokens에 저장, 관리자 페이지로 리다이렉트
 * GET ?status=1: 현재 토큰 상태 확인 (JSON 반환)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { buildGscAuthUrl, exchangeCodeForTokens, saveGscToken, getValidAccessToken } from '@/lib/gsc-client';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const statusOnly = url.searchParams.get('status');

  if (statusOnly) {
    const token = await getValidAccessToken();
    return NextResponse.json({ ok: !!token, has_token: !!token });
  }

  if (!code) {
    // 승인 URL로 리다이렉트
    const state = crypto.randomUUID();
    const authUrl = buildGscAuthUrl(state);
    if (!authUrl) {
      return NextResponse.json({ error: 'GOOGLE_OAUTH_CLIENT_ID 환경변수 미설정. docs/GSC_SETUP.md 참고.' }, { status: 500 });
    }
    return NextResponse.redirect(authUrl);
  }

  // callback: code 교환
  const token = await exchangeCodeForTokens(code);
  if (!token) {
    return NextResponse.json({ error: 'code exchange failed. client_id/secret 확인.' }, { status: 400 });
  }
  const ok = await saveGscToken(token);
  if (!ok) {
    return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
  }
  // 관리자 페이지로 돌아가기
  const redirectUrl = new URL('/admin', url.origin);
  redirectUrl.searchParams.set('gsc', 'connected');
  return NextResponse.redirect(redirectUrl);
}
