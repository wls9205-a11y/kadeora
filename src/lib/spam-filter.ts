/**
 * 스팸 URL 필터
 * 카톡 오픈채팅, 텔레그램, 라인 등 스팸성 링크 차단
 */

const BLOCKED_URL_PATTERNS: RegExp[] = [
  // 카카오 오픈채팅
  /open\.kakao\.com/i,
  /kakao\.com\/o\//i,
  // 텔레그램
  /t\.me\//i,
  /telegram\.me\//i,
  /telegram\.org/i,
  // 라인
  /line\.me\//i,
  // 디스코드 초대
  /discord\.gg\//i,
  /discord\.com\/invite\//i,
  // 위챗
  /weixin\.qq\.com/i,
  // 네이버 카페/밴드 초대 (스팸성)
  /band\.us\/n\//i,
  // 광고성 단축 URL 서비스
  /bit\.ly\//i,
  /tinyurl\.com\//i,
  /goo\.gl\//i,
  /is\.gd\//i,
  /v\.gd\//i,
  /rb\.gy\//i,
  /han\.gl\//i,
  /me2\.do\//i,
  /vo\.la\//i,
  /durl\.me\//i,
  /url\.kr\//i,
  /zrr\.kr\//i,
  // 불법 도박/성인 사이트 키워드
  /casino/i,
  /slot[s]?\.(?:com|net|org|io)/i,
  /poker[0-9]*\.(?:com|net)/i,
  /betting\.(?:com|net)/i,
];

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

/**
 * 텍스트에서 차단 URL이 있는지 검사
 * @returns 차단된 URL 패턴이 발견되면 true
 */
export function containsBlockedUrl(text: string): boolean {
  if (!text) return false;
  const urls = text.match(URL_REGEX);
  if (!urls) return false;
  return urls.some(url =>
    BLOCKED_URL_PATTERNS.some(pattern => pattern.test(url))
  );
}

/**
 * 차단된 URL 목록 반환 (관리자 로깅용)
 */
export function getBlockedUrls(text: string): string[] {
  if (!text) return [];
  const urls = text.match(URL_REGEX);
  if (!urls) return [];
  return urls.filter(url =>
    BLOCKED_URL_PATTERNS.some(pattern => pattern.test(url))
  );
}
