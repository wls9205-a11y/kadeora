/**
 * 카더라 이메일 템플릿
 */

export function reEngagementEmail({ nickname, email }: { nickname: string; email: string }): string {
  const utmBase = 'utm_source=email&utm_medium=re-engagement&utm_campaign=april_2026';
  const siteUrl = `https://kadeora.app?${utmBase}`;
  const unsubUrl = `https://kadeora.app/api/unsubscribe?email=${encodeURIComponent(email)}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0F1C;font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic','맑은 고딕',sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;color:#0A0F1C;">${nickname}님, 놓치고 있는 투자 정보가 있어요 →</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F1C;">
<tr><td align="center" style="padding:20px 16px 40px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

<tr><td style="padding:24px 0 20px;text-align:center;">
  <span style="font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;">카더라</span>
  <span style="font-size:11px;color:rgba(255,255,255,0.2);margin-left:6px;">kadeora.app</span>
</td></tr>

<tr><td style="background:linear-gradient(135deg,#0C1528,#111D35);border-radius:16px;border:1px solid rgba(59,123,246,0.12);padding:28px 24px;">
  <p style="font-size:16px;font-weight:700;color:#E2E8F0;margin:0 0 6px;line-height:1.5;">${nickname}님, 안녕하세요! 👋</p>
  <p style="font-size:13px;color:rgba(255,255,255,0.45);margin:0 0 24px;line-height:1.6;">카더라에 가입해 주셔서 감사합니다.<br>혹시 바쁘셔서 놓치신 건 아닌지, 최근 업데이트를 알려드려요.</p>
  <div style="height:1px;background:rgba(255,255,255,0.06);margin:0 0 20px;"></div>

  <table width="100%" cellpadding="0" cellspacing="0">
    ${[
      { icon: '🏠', bg: 'rgba(59,123,246,0.1)', title: '청약 마감 알림', desc: '관심 단지 청약 마감일, D-day 알림을 받아보세요. 놓치면 1년을 기다려야 합니다.' },
      { icon: '📈', bg: 'rgba(16,185,129,0.1)', title: 'AI 종목 분석', desc: '728개 종목의 AI 투자 의견, 적정가 분석을 무료로 확인하세요.' },
      { icon: '💰', bg: 'rgba(245,158,11,0.1)', title: '실거래가 알림', desc: '내 관심 단지의 실거래가 변동을 실시간으로 추적합니다.' },
    ].map(f => `
    <tr><td style="padding:10px 0;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:36px;vertical-align:top;"><div style="width:32px;height:32px;border-radius:8px;background:${f.bg};text-align:center;line-height:32px;font-size:16px;">${f.icon}</div></td>
        <td style="padding-left:12px;">
          <p style="font-size:14px;font-weight:700;color:#E2E8F0;margin:0 0 2px;">${f.title}</p>
          <p style="font-size:12px;color:rgba(255,255,255,0.35);margin:0;line-height:1.5;">${f.desc}</p>
        </td>
      </tr></table>
    </td></tr>`).join('')}
  </table>

  <div style="text-align:center;margin:28px 0 8px;">
    <a href="${siteUrl}" style="display:inline-block;padding:14px 40px;border-radius:12px;background:#FEE500;color:#191919;font-size:15px;font-weight:800;text-decoration:none;">카더라 바로 가기 →</a>
  </div>
  <p style="font-size:11px;color:rgba(255,255,255,0.15);text-align:center;margin:8px 0 0;">카카오 로그인으로 3초 만에 시작</p>
</td></tr>

<tr><td style="padding:20px 0 0;text-align:center;">
  <p style="font-size:11px;color:rgba(255,255,255,0.15);margin:0;line-height:1.8;">
    🏠 2,948개 분양 단지 분석 · 📈 728개 종목 AI 브리핑<br>✅ 70명+ 투자자가 함께하고 있어요
  </p>
</td></tr>

<tr><td style="padding:24px 0 0;">
  <p style="font-size:10px;color:rgba(255,255,255,0.1);text-align:center;margin:0;line-height:1.8;">
    이 메일은 카더라(kadeora.app) 가입 시 동의하신 이메일로 발송되었습니다.<br>
    수신을 원하지 않으시면 <a href="${unsubUrl}" style="color:rgba(255,255,255,0.2);text-decoration:underline;">수신거부</a>를 클릭해주세요.<br><br>
    © 2026 카더라 · 부산광역시
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export const EMAIL_SUBJECTS: Record<string, string> = {
  're-engagement': '{{nickname}}님, 놓치고 있는 투자 정보가 있어요 📊',
};
