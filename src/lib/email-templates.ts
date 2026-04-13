/**
 * 카더라 이메일 템플릿 — 라이트 테마, 모바일 최적화
 */

import { createHmac } from 'crypto';

export function generateUnsubToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || 'kadeora-unsub-secret';
  return createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex');
}

export function buildUnsubUrl(email: string): string {
  const token = generateUnsubToken(email);
  return `https://kadeora.app/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

/** 현재 연월 기반 UTM campaign 문자열 (예: 2026_04) */
function currentUtmCampaign(): string {
  return new Date().toISOString().slice(0, 7).replace('-', '_');
}

export function reEngagementEmail({
  nickname,
  email,
  utmCampaign,
}: {
  nickname: string;
  email: string;
  utmCampaign?: string;
}): string {
  const campaign = utmCampaign || currentUtmCampaign();
  const utmBase = `utm_source=email&utm_medium=re-engagement&utm_campaign=${campaign}`;
  const siteUrl = `https://kadeora.app?${utmBase}`;
  const blogUrl = `https://kadeora.app/blog?${utmBase}`;
  const unsubUrl = buildUnsubUrl(email);

  const features = [
    { icon: '🏠', title: '청약 마감 알림', desc: '관심 단지 청약 마감 D-day를 놓치지 마세요' },
    { icon: '📈', title: 'AI 종목 분석', desc: '1,800+ 종목의 AI 투자 의견을 무료로 확인' },
    { icon: '💰', title: '실거래가 알림', desc: '관심 단지의 시세 변동을 실시간 추적' },
  ];

  const featuresHtml = features.map(f => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #F1F5F9;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="width:44px;vertical-align:top;">
          <div style="width:40px;height:40px;border-radius:10px;background:#F8FAFC;text-align:center;line-height:40px;font-size:20px;">${f.icon}</div>
        </td>
        <td style="padding-left:14px;">
          <p style="font-size:15px;font-weight:700;color:#1E293B;margin:0 0 3px;">${f.title}</p>
          <p style="font-size:13px;color:#64748B;margin:0;line-height:1.5;">${f.desc}</p>
        </td>
      </tr></table>
    </td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;-webkit-font-smoothing:antialiased;">

<!-- 프리헤더 -->
<div style="display:none;max-height:0;overflow:hidden;color:#F1F5F9;font-size:1px;">${nickname}님, 카더라에서 새 분석이 기다리고 있어요</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;">
<tr><td align="center" style="padding:32px 16px 40px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

<!-- 로고 -->
<tr><td style="padding:0 0 20px;text-align:center;">
  <a href="${siteUrl}" style="text-decoration:none;">
    <span style="font-size:22px;font-weight:900;color:#1E293B;letter-spacing:-0.5px;">카더라</span>
    <span style="font-size:11px;color:#94A3B8;margin-left:4px;">kadeora.app</span>
  </a>
</td></tr>

<!-- 본문 카드 -->
<tr><td style="background:#FFFFFF;border-radius:16px;padding:32px 24px;">

  <p style="font-size:18px;font-weight:700;color:#1E293B;margin:0 0 8px;line-height:1.4;">
    ${nickname}님, 안녕하세요! 👋
  </p>
  <p style="font-size:15px;color:#64748B;margin:0 0 24px;line-height:1.7;">
    카더라에 가입해 주셔서 감사합니다.<br>
    바쁘셔서 놓치신 건 아닌지, 최근 업데이트를 알려드려요.
  </p>

  <div style="height:1px;background:#E2E8F0;margin:0 0 20px;"></div>

  <!-- 기능 소개 -->
  <table width="100%" cellpadding="0" cellspacing="0">
    ${featuresHtml}
  </table>

  <!-- CTA 버튼 -->
  <div style="text-align:center;margin:28px 0 12px;">
    <a href="${siteUrl}" style="display:inline-block;padding:14px 48px;border-radius:12px;background:#3B7BF6;color:#FFFFFF;font-size:16px;font-weight:800;text-decoration:none;">
      카더라 바로가기 →
    </a>
  </div>
  <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">
    카카오 로그인으로 3초 만에 시작
  </p>

</td></tr>

<!-- 블로그 유도 -->
<tr><td style="padding:16px 0 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;padding:16px 20px;">
    <tr><td style="text-align:center;">
      <p style="font-size:13px;color:#64748B;margin:0 0 6px;">
        📰 7,600+ 분석 블로그를 무료로 읽어보세요
      </p>
      <a href="${blogUrl}" style="font-size:14px;font-weight:700;color:#3B7BF6;text-decoration:none;">
        블로그 둘러보기 →
      </a>
    </td></tr>
  </table>
</td></tr>

<!-- 푸터 -->
<tr><td style="padding:24px 0 0;text-align:center;">
  <p style="font-size:12px;color:#94A3B8;margin:0 0 8px;line-height:1.6;">
    이 메일은 카더라(kadeora.app) 가입 시 동의하신 이메일로 발송되었습니다.
  </p>
  <p style="font-size:12px;margin:0;">
    <a href="${unsubUrl}" style="color:#64748B;text-decoration:underline;">수신거부</a>
    <span style="color:#CBD5E1;margin:0 8px;">·</span>
    <a href="https://kadeora.app/notifications/settings?utm_source=email" style="color:#64748B;text-decoration:underline;">알림 설정</a>
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

/** 주간 다이제스트 본문 생성 */
export function weeklyDigestBody(data: {
  hotPosts: { title: string; slug: string; likes_count?: number }[];
  deadlines: { house_nm: string; rcept_endde: string }[];
  newBlogs: { title: string; slug: string; category?: string }[];
}): string {
  const campaign = currentUtmCampaign();
  const utmBase = `utm_source=email&utm_medium=digest&utm_campaign=${campaign}`;

  const hotHtml = data.hotPosts.length > 0
    ? `<div style="margin:0 0 20px;">
        <p style="font-size:14px;font-weight:700;color:#1E293B;margin:0 0 8px;">🔥 이번 주 인기글</p>
        ${data.hotPosts.map((p, i) => `
          <div style="padding:10px 0;border-bottom:1px solid #F1F5F9;">
            <span style="color:#3B7BF6;font-weight:700;font-size:14px;">${i + 1}.</span>
            <a href="https://kadeora.app/feed/${p.slug}?${utmBase}" style="color:#334155;text-decoration:none;font-size:14px;font-weight:500;margin-left:6px;">${p.title}</a>
            ${p.likes_count ? `<span style="color:#94A3B8;font-size:12px;margin-left:8px;">❤️ ${p.likes_count}</span>` : ''}
          </div>
        `).join('')}
      </div>` : '';

  const deadlineHtml = data.deadlines.length > 0
    ? `<div style="margin:0 0 20px;">
        <p style="font-size:14px;font-weight:700;color:#1E293B;margin:0 0 8px;">🏠 이번 주 청약 마감</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${data.deadlines.map(d => `
            <span style="display:inline-block;padding:6px 12px;border-radius:8px;background:#FEF2F2;color:#DC2626;font-size:13px;font-weight:600;">
              ${d.house_nm} ~${d.rcept_endde?.slice(5)}
            </span>
          `).join('')}
        </div>
      </div>` : '';

  const blogHtml = data.newBlogs.length > 0
    ? `<div style="margin:0 0 20px;">
        <p style="font-size:14px;font-weight:700;color:#1E293B;margin:0 0 8px;">📝 새 분석 블로그</p>
        ${data.newBlogs.map(b => `
          <div style="padding:8px 0;">
            <a href="https://kadeora.app/blog/${b.slug}?${utmBase}" style="color:#334155;text-decoration:none;font-size:14px;">
              ${b.title}
            </a>
          </div>
        `).join('')}
      </div>` : '';

  return `
    ${hotHtml}
    ${deadlineHtml}
    ${blogHtml}
    <div style="text-align:center;margin:24px 0 0;">
      <a href="https://kadeora.app/blog?${utmBase}" style="display:inline-block;padding:12px 36px;border-radius:10px;background:#3B7BF6;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">
        전체 확인하기 →
      </a>
    </div>
  `;
}

export const EMAIL_SUBJECTS: Record<string, string> = {
  're-engagement': '{{nickname}}님, 놓치고 있는 투자 정보가 있어요 📊',
  'weekly-digest': '{{nickname}}님의 주간 투자 리포트 📊',
};

/** ① 환영 이메일 (P2) — 가입 직후 */
export function welcomeBody({ nickname }: { nickname: string }): string {
  const utmBase = 'utm_source=email&utm_medium=welcome&utm_campaign=onboarding';
  return `
    <p style="font-size:16px;color:#1E293B;margin:0 0 16px;font-weight:500;">
      ${nickname}님, 카더라에 오신 걸 환영합니다!
    </p>
    <p style="font-size:14px;color:#64748B;line-height:1.7;margin:0 0 20px;">
      매일 업데이트되는 청약 일정, 실거래가 분석, AI 종목 브리핑을<br>
      지금 바로 확인해보세요.
    </p>
    <div style="margin:0 0 20px;">
      ${[
        { icon: '🏠', title: '분양·청약 마감 알림', desc: '관심 단지 등록하면 마감 D-day 알림' },
        { icon: '📈', title: '주식 실시간 시세', desc: '1,800+ 종목 시세 + AI 분석' },
        { icon: '🧮', title: '투자 계산기', desc: '청약 가점, 대출, 수익률 등 20종+' },
      ].map(f => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F1F5F9;">
          <span style="font-size:20px;">${f.icon}</span>
          <div>
            <div style="font-size:14px;font-weight:500;color:#1E293B;">${f.title}</div>
            <div style="font-size:12px;color:#94A3B8;">${f.desc}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="https://kadeora.app/feed?${utmBase}" style="display:inline-block;padding:12px 36px;border-radius:10px;background:#3B7BF6;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">
        카더라 시작하기 →
      </a>
    </div>
  `;
}

/** ④ D+3 기능 안내 (P5) */
export function onboardingGuideBody({ nickname, interests }: { nickname: string; interests: string[] }): string {
  const utmBase = 'utm_source=email&utm_medium=onboarding_d3&utm_campaign=onboarding';
  const isApt = interests.includes('apt');
  const isStock = interests.includes('stock');
  const tips = [];
  if (isApt) tips.push({ icon: '🔔', title: '관심단지 알림 설정', desc: '부동산 탭에서 관심 단지를 등록하면 마감·시세 변동 알림을 받아요', link: '/apt' });
  if (isStock) tips.push({ icon: '⭐', title: '관심종목 추가', desc: '종목 페이지에서 ⭐ 누르면 급등·공시 알림을 받아요', link: '/stock' });
  tips.push({ icon: '📰', title: '블로그 분석 읽기', desc: '매일 업데이트되는 AI 분석 블로그를 확인해보세요', link: '/blog' });
  tips.push({ icon: '🌱', title: '출석 체크 +10P', desc: '매일 출석하면 포인트 적립, 7일 연속 시 50P 보너스!', link: '/attendance' });

  return `
    <p style="font-size:15px;color:#1E293B;margin:0 0 16px;">
      ${nickname}님, 카더라 잘 쓰고 계신가요?
    </p>
    <p style="font-size:14px;color:#64748B;line-height:1.7;margin:0 0 20px;">
      아직 써보지 못한 기능이 있을 수 있어서, 꿀팁을 정리해봤어요.
    </p>
    ${tips.map(t => `
      <div style="padding:14px;margin:0 0 10px;border-radius:10px;background:#F8FAFC;border:1px solid #E2E8F0;">
        <div style="display:flex;align-items:center;gap:10px;margin:0 0 6px;">
          <span style="font-size:18px;">${t.icon}</span>
          <span style="font-size:14px;font-weight:500;color:#1E293B;">${t.title}</span>
        </div>
        <div style="font-size:13px;color:#64748B;line-height:1.6;">${t.desc}</div>
      </div>
    `).join('')}
    <div style="text-align:center;margin:24px 0 0;">
      <a href="https://kadeora.app/feed?${utmBase}" style="display:inline-block;padding:12px 36px;border-radius:10px;background:#3B7BF6;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">
        카더라 둘러보기 →
      </a>
    </div>
  `;
}

/** ⑨ 콘텐츠 추천 (P9) — 잔여 한도 채우기 */
export function contentRecommendBody({ nickname, posts }: {
  nickname: string;
  posts: { title: string; slug: string; category: string; view_count: number }[];
}): string {
  const utmBase = 'utm_source=email&utm_medium=recommend&utm_campaign=content';
  const catLabel: Record<string, string> = { apt: '🏠 부동산', stock: '📈 주식', finance: '💰 재테크' };
  return `
    <p style="font-size:15px;color:#1E293B;margin:0 0 6px;">
      ${nickname}님을 위한 이번 주 추천
    </p>
    <p style="font-size:13px;color:#94A3B8;margin:0 0 20px;">
      이번 주 가장 많이 읽힌 분석을 모아봤어요
    </p>
    ${posts.map((p, i) => `
      <div style="padding:12px 0;border-bottom:1px solid #F1F5F9;">
        <div style="display:flex;align-items:center;gap:8px;margin:0 0 4px;">
          <span style="font-size:14px;font-weight:500;color:#3B7BF6;">${i + 1}.</span>
          <span style="font-size:11px;color:#94A3B8;">${catLabel[p.category] || '📝 분석'}</span>
          <span style="font-size:11px;color:#CBD5E1;">조회 ${p.view_count?.toLocaleString()}</span>
        </div>
        <a href="https://kadeora.app/blog/${p.slug}?${utmBase}" style="font-size:14px;color:#334155;text-decoration:none;line-height:1.5;font-weight:500;">
          ${p.title}
        </a>
      </div>
    `).join('')}
    <div style="text-align:center;margin:24px 0 0;">
      <a href="https://kadeora.app/blog?${utmBase}" style="display:inline-block;padding:12px 36px;border-radius:10px;background:#3B7BF6;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">
        더 많은 분석 보기 →
      </a>
    </div>
  `;
}
