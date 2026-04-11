import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 네이버 OAuth 콜백
 * 
 * 1. 네이버 개발자센터에서 앱 등록 (카페 글쓰기 권한)
 * 2. Callback URL: https://kadeora.app/api/naver/callback
 * 3. 어드민에서 인증 시작 → 네이버 로그인 → 여기로 리다이렉트 → 토큰 발급
 * 
 * 인증 시작 URL:
 * https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id={CLIENT_ID}&redirect_uri={CALLBACK_URL}&state=kadeora
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ ok: false, error, description: searchParams.get('error_description') }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ ok: false, error: 'No authorization code' }, { status: 400 });
  }

  const clientId = process.env.NAVER_CAFE_CLIENT_ID || '';
  const clientSecret = process.env.NAVER_CAFE_CLIENT_SECRET || '';
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app'}/api/naver/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      state: state || 'kadeora',
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return NextResponse.json({ ok: false, error: tokenData.error, description: tokenData.error_description }, { status: 400 });
  }

  // 토큰 정보 표시 (어드민이 복사하여 Vercel 환경변수에 저장)
  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>네이버 인증 완료</title>
<style>body{font-family:Pretendard,sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#050A18;color:#e0e0e0}
h1{color:#03C75A}pre{background:#0C1528;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.6}
.warn{color:#F59E0B;font-size:13px;margin-top:16px}</style></head>
<body>
<h1>✅ 네이버 인증 완료</h1>
<p>아래 토큰을 Vercel 환경변수에 저장하세요:</p>
<pre>
NAVER_CAFE_ACCESS_TOKEN=${tokenData.access_token}
NAVER_CAFE_REFRESH_TOKEN=${tokenData.refresh_token}
</pre>
<p class="warn">⚠️ access_token 유효기간: ${tokenData.expires_in}초 (약 ${Math.round((tokenData.expires_in || 3600) / 3600)}시간)<br/>
refresh_token으로 자동 갱신되므로 refresh_token을 반드시 저장하세요.</p>
<p>저장 후 <a href="/admin" style="color:#3B7BF6">어드민</a>에서 카페 발행 테스트가 가능합니다.</p>
</body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
