import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/unsubscribe?email=xxx
 * 이메일 수신거부 처리
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return new NextResponse(html('잘못된 요청입니다.', false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  try {
    const sb = getSupabaseAdmin();
    await (sb as any).from('email_subscribers').update({
      is_active: false,
      unsubscribed_at: new Date().toISOString(),
    }).eq('email', email.toLowerCase().trim());

    return new NextResponse(html('수신거부가 완료되었습니다.', true), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch {
    return new NextResponse(html('처리 중 오류가 발생했습니다.', false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

function html(message: string, success: boolean) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>카더라 - 수신거부</title></head>
<body style="margin:0;padding:0;background:#0A0F1C;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="text-align:center;padding:40px 24px;">
  <div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:8px;">카더라</div>
  <div style="font-size:${success ? '48' : '32'}px;margin:16px 0;">${success ? '✅' : '❌'}</div>
  <p style="font-size:16px;color:${success ? '#10B981' : '#EF4444'};font-weight:700;margin:0 0 8px;">${message}</p>
  <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:0 0 24px;">더 이상 카더라 이메일을 받지 않습니다.</p>
  <a href="https://kadeora.app" style="color:#3B7BF6;text-decoration:none;font-size:13px;">← 카더라로 돌아가기</a>
</div></body></html>`;
}
