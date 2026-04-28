/**
 * share-utm — 공유 URL 에 UTM 파라미터 일관 적용 + OG 이미지 helpers.
 *  s189: 카카오/네이버/트위터 등 공유 채널별 attribution 추적 + 디자인 통일.
 */

export type SharePlatform =
  | 'kakao'
  | 'kakaostory'
  | 'naverblog'
  | 'naverband'
  | 'naver'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'threads'
  | 'instagram'
  | 'telegram'
  | 'whatsapp'
  | 'sms'
  | 'email';

export type ShareCampaign =
  | 'blog_share'
  | 'apt_share'
  | 'stock_share'
  | 'feed_share'
  | 'newsletter'
  | 'general';

/**
 * 외부 공유용 URL 에 UTM 파라미터 부여.
 *  url 가 이미 utm_* 를 갖고 있으면 덮어쓰지 않음 (idempotent).
 */
export function withUtm(
  url: string,
  platform: SharePlatform,
  campaign: ShareCampaign = 'general',
  extra: Record<string, string> = {}
): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', platform);
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'social');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', campaign);
    for (const [k, v] of Object.entries(extra)) {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    // invalid URL — string fallback
    const sep = url.includes('?') ? '&' : '?';
    const qs = new URLSearchParams({
      utm_source: platform,
      utm_medium: 'social',
      utm_campaign: campaign,
      ...extra,
    }).toString();
    return `${url}${sep}${qs}`;
  }
}

/**
 * 카카오톡 공유용 OG 이미지 URL.
 *  카카오 권장: 1200x630 (default design 2 = navy hero).
 */
export function kakaoOgImageUrl(
  siteUrl: string,
  title: string,
  category: string,
  design: number = 2
): string {
  const t = encodeURIComponent(title);
  return `${siteUrl}/api/og?title=${t}&category=${category}&design=${design}`;
}

/**
 * 네이버 블로그 공유용 정사각형 OG 이미지 (1080x1080).
 *  네이버 카드 미리보기는 정사각형이 best fit.
 */
export function naverSquareOgImageUrl(
  siteUrl: string,
  title: string,
  category: string
): string {
  const t = encodeURIComponent(title);
  return `${siteUrl}/api/og-square?title=${t}&category=${category}`;
}
