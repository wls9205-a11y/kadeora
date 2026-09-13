import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyUnsubToken } from '@/lib/unsub-token';

/**
 * GET /api/unsubscribe?email=xxx&token=yyy
 *
 * token = HMAC-SHA256(email, UNSUBSCRIBE_SECRET) — 위조 방지. 규칙은 lib/unsub-token.ts 한 곳.
 * ⚠️ 구 폴백 서명은 2026-10-11 KST 까지만 받는다(기발송 메일 링크 보존) — 그 뒤 자동 거부.
 * 이메일 수신거부 — email_subscribers + profiles.marketing_agreed 동시 해제
 */

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  const token = req.nextUrl.searchParams.get('token');

  if (!email) {
    return new NextResponse(html('잘못된 요청입니다.', false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // 토큰 검증
  // ⚠️ 비밀 미설정·불일치는 «명시 거부» 페이지(200 HTML). 500 이면 메일 클라이언트에서 깨진 화면이 된다.
  if (!verifyUnsubToken(email, token)) {
    return new NextResponse(html('유효하지 않은 수신거부 링크입니다.', false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  try {
    const sb = getSupabaseAdmin();
    const normalEmail = email.toLowerCase().trim();

    // 1. email_subscribers 비활성화
    await (sb as any).from('email_subscribers').update({
      is_active: false,
      unsubscribed_at: new Date().toISOString(),
    }).eq('email', normalEmail);

    // 2. auth.users → profiles.marketing_agreed 해제 (filter 파라미터로 정확히 조회)
    try {
      const { data: { users } } = await sb.auth.admin.listUsers({
        filter: `email.eq.${normalEmail}`,
        perPage: 1,
      } as any);
      const targetUser = users?.[0];
      if (targetUser?.id) {
        await sb.from('profiles').update({
          marketing_agreed: false,
          updated_at: new Date().toISOString(),
        }).eq('id', targetUser.id);
      }
    } catch { /* 프로필 없어도 subscriber는 해제됨 */ }

    return new NextResponse(html('수신거부가 완료되었습니다.', true), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch {
    return new NextResponse(html('처리 중 오류가 발생했습니다.', false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

function html(message: string, success: boolean) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>카더라 - 수신거부</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="text-align:center;padding:40px 24px;background:#fff;border-radius:16px;max-width:400px;margin:20px;">
  <div style="font-size:24px;font-weight:900;color:#1E293B;margin-bottom:8px;">카더라</div>
  <div style="font-size:${success ? '48' : '32'}px;margin:20px 0;">${success ? '✅' : '❌'}</div>
  <p style="font-size:16px;color:${success ? '#10B981' : '#EF4444'};font-weight:700;margin:0 0 8px;">${message}</p>
  <p style="font-size:13px;color:#94A3B8;margin:0 0 24px;">더 이상 카더라 이메일을 받지 않습니다.</p>
  <a href="https://kadeora.app" style="display:inline-block;padding:10px 24px;border-radius:8px;background:#3B7BF6;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">카더라로 돌아가기</a>
</div></body></html>`;
}
