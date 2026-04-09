/**
 * 유입경로 세분화 분류기
 * 
 * Direct / Google / Naver / Daum / Kakao / Bing / Zum
 * + 한국 커뮤니티: 디시, 클리앙, 뽐뿌, 루리웹, 에펨코리아, 인벤, 블라인드, 더쿠
 * + SNS: Instagram, Facebook, Twitter/X, YouTube, TikTok, Threads
 * + 메신저: Telegram, Line, Band
 * + 해외 검색: Yahoo, DuckDuckGo, Yandex, Baidu
 * + AI: ChatGPT, Perplexity, Claude
 * + 기타 포털: Tistory, Velog, Medium, Brunch
 */

const RULES: [string[], string][] = [
  // 검색엔진
  [['google.com','google.co.kr','googleapis.com'], 'Google'],
  [['search.naver.com','m.search.naver.com'], 'Naver 검색'],
  [['blog.naver.com','m.blog.naver.com'], 'Naver 블로그'],
  [['cafe.naver.com','m.cafe.naver.com'], 'Naver 카페'],
  [['news.naver.com','n.news.naver.com'], 'Naver 뉴스'],
  [['naver.com'], 'Naver'],
  [['search.daum.net','m.search.daum.net'], 'Daum 검색'],
  [['cafe.daum.net'], 'Daum 카페'],
  [['daum.net','daum.co.kr'], 'Daum'],
  [['zum.com','search.zum.com'], 'Zum'],
  [['bing.com'], 'Bing'],
  [['yahoo.com','search.yahoo'], 'Yahoo'],
  [['duckduckgo.com'], 'DuckDuckGo'],
  [['yandex.com','yandex.ru'], 'Yandex'],
  [['baidu.com'], 'Baidu'],
  // 카카오
  [['pf.kakao.com','story.kakao.com'], 'Kakao 채널'],
  [['kakao.com','kakaocdn.net'], 'Kakao'],
  // 한국 커뮤니티
  [['dcinside.com','gall.dcinside.com','m.dcinside.com'], 'DCinside'],
  [['clien.net'], 'Clien'],
  [['ppomppu.co.kr'], 'Ppomppu'],
  [['ruliweb.com'], 'Ruliweb'],
  [['fmkorea.com'], 'FMKorea'],
  [['inven.co.kr'], 'Inven'],
  [['blind.com','teamblind.com'], 'Blind'],
  [['theqoo.net'], 'Theqoo'],
  [['mlbpark.donga.com'], 'MLBPark'],
  [['bobaedream.co.kr'], 'Bobaedream'],
  [['todayhumor.co.kr'], 'Humor'],
  [['instiz.net'], 'Instiz'],
  [['arcalive.com'], 'Arca'],
  // SNS
  [['instagram.com','l.instagram.com'], 'Instagram'],
  [['facebook.com','l.facebook.com','m.facebook.com','fb.com'], 'Facebook'],
  [['twitter.com','t.co','x.com'], 'X(Twitter)'],
  [['youtube.com','youtu.be','m.youtube.com'], 'YouTube'],
  [['tiktok.com'], 'TikTok'],
  [['threads.net'], 'Threads'],
  // 메신저
  [['telegram.org','t.me'], 'Telegram'],
  [['line.me'], 'Line'],
  [['band.us'], 'Band'],
  // 블로그 플랫폼
  [['tistory.com'], 'Tistory'],
  [['velog.io'], 'Velog'],
  [['medium.com'], 'Medium'],
  [['brunch.co.kr'], 'Brunch'],
  // AI
  [['chat.openai.com','chatgpt.com'], 'ChatGPT'],
  [['perplexity.ai'], 'Perplexity'],
  [['claude.ai'], 'Claude'],
];

/**
 * referrer URL → 유입 소스명 반환
 * 빈 문자열이면 'Direct'
 */
export function classifyReferrer(referrer: string | null | undefined): string {
  if (!referrer || referrer.trim() === '') return 'Direct';
  const ref = referrer.toLowerCase();
  // 자체 도메인
  if (ref.includes('kadeora.app') || ref.includes('kadeora.vercel.app')) return 'Internal';
  for (const [domains, label] of RULES) {
    if (domains.some(d => ref.includes(d))) return label;
  }
  return 'Other';
}

/**
 * 대시보드용 상위 카테고리로 묶기
 * 세분화된 라벨 → 상위 그룹
 */
export function classifyReferrerGroup(referrer: string | null | undefined): string {
  const label = classifyReferrer(referrer);
  if (label === 'Direct' || label === 'Internal') return label;
  if (label.startsWith('Google') || label.startsWith('Bing') || label.startsWith('Yahoo') || label.startsWith('DuckDuckGo') || label.startsWith('Yandex') || label.startsWith('Baidu') || label.startsWith('Zum')) return '검색';
  if (label.startsWith('Naver')) return 'Naver';
  if (label.startsWith('Daum')) return 'Daum';
  if (label.startsWith('Kakao')) return 'Kakao';
  if (['DCinside','Clien','Ppomppu','Ruliweb','FMKorea','Inven','Blind','Theqoo','MLBPark','Bobaedream','Humor','Instiz','Arca'].includes(label)) return '커뮤니티';
  if (['Instagram','Facebook','X(Twitter)','YouTube','TikTok','Threads'].includes(label)) return 'SNS';
  if (['Telegram','Line','Band'].includes(label)) return '메신저';
  if (['Tistory','Velog','Medium','Brunch'].includes(label)) return '블로그';
  if (['ChatGPT','Perplexity','Claude'].includes(label)) return 'AI';
  return 'Other';
}
