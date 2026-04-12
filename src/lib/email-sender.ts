/**
 * email-sender.ts — Resend 이메일 발송 래퍼
 * 
 * 무료 한도: 100통/일, 3,000통/월
 * 일일 상한: 1건/유저 (notification-hub에서 관리)
 * 
 * 사전 요구: kadeora.app 도메인 DNS에 SPF/DKIM/DMARC 레코드 등록
 */

let resendInstance: any = null;

function getResend(): any | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendInstance) {
    try {
      // Resend는 선택적 의존성 — 설치 안 되어 있으면 null 반환
      const { Resend } = require('resend');
      resendInstance = new Resend(key);
    } catch {
      return null;
    }
  }
  return resendInstance;
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; id?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false };

  try {
    const { data, error } = await resend.emails.send({
      from: '카더라 <noreply@kadeora.app>',
      to,
      subject,
      html: wrapEmailTemplate(subject, html),
    });
    return { ok: !error, id: data?.id };
  } catch (e) {
    console.error('[email-sender]', e);
    return { ok: false };
  }
}

function wrapEmailTemplate(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0F1C;font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F1C;">
<tr><td align="center" style="padding:20px 16px 40px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td style="padding:20px 0;text-align:center;">
  <span style="font-size:20px;font-weight:900;color:#FFF;">카더라</span>
</td></tr>
<tr><td style="background:#0C1528;border-radius:12px;border:1px solid rgba(59,123,246,0.12);padding:24px;">
  <p style="font-size:15px;font-weight:700;color:#E2E8F0;margin:0 0 12px;">${subject}</p>
  <div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">${body}</div>
</td></tr>
<tr><td style="padding:16px 0 0;text-align:center;">
  <p style="font-size:10px;color:rgba(255,255,255,0.15);margin:0;">
    © 2026 카더라 · <a href="https://kadeora.app/api/unsubscribe?email=\${encodeURIComponent(to)}" style="color:rgba(255,255,255,0.2);text-decoration:underline;">수신거부</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
