/**
 * email-sender.ts — Resend 이메일 발송 래퍼
 * 
 * 무료 한도: 100통/일, 3,000통/월
 */

import { buildUnsubUrl } from './email-templates';
import { SITE_URL } from '@/lib/constants';

let resendInstance: any = null;

function getResend(): any | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendInstance) {
    try {
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
      html: wrapEmailTemplate(to, subject, html),
    });
    return { ok: !error, id: data?.id };
  } catch (e) {
    console.error('[email-sender]', e);
    return { ok: false };
  }
}

/**
 * 공통 이메일 래퍼 — 라이트 테마, 모바일 최적화, 서명된 수신거부 URL
 */
function wrapEmailTemplate(to: string, subject: string, body: string): string {
  const unsubUrl = buildUnsubUrl(to);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;color:#F1F5F9;font-size:1px;">${subject} — 카더라</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;">
<tr><td align="center" style="padding:32px 16px 40px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 0 20px;text-align:center;">
  <a href="${SITE_URL}?utm_source=email" style="text-decoration:none;">
    <span style="font-size:22px;font-weight:900;color:#1E293B;letter-spacing:-0.5px;">카더라</span>
    <span style="font-size:11px;color:#94A3B8;margin-left:4px;">kadeora.app</span>
  </a>
</td></tr>
<tr><td style="background:#FFFFFF;border-radius:16px;padding:28px 24px;">
  <p style="font-size:17px;font-weight:700;color:#1E293B;margin:0 0 16px;line-height:1.5;">${subject}</p>
  <div style="font-size:15px;color:#475569;line-height:1.8;">${body}</div>
</td></tr>
<tr><td style="padding:24px 0 0;text-align:center;">
  <p style="font-size:12px;color:#94A3B8;margin:0 0 8px;line-height:1.6;">
    이 메일은 카더라(kadeora.app) 알림 설정에 따라 발송되었습니다.
  </p>
  <p style="font-size:12px;margin:0;">
    <a href="${unsubUrl}" style="color:#64748B;text-decoration:underline;">수신거부</a>
    <span style="color:#CBD5E1;margin:0 8px;">·</span>
    <a href="${SITE_URL}/notifications/settings?utm_source=email" style="color:#64748B;text-decoration:underline;">알림 설정</a>
  </p>
  <p style="font-size:11px;color:#CBD5E1;margin:16px 0 0;">
    © 2026 카더라 · 부산광역시 연제구 연동로 27
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
