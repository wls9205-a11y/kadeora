/**
 * IndexNow — Bing/Yandex/Naver에 URL 즉시 색인 요청
 * 블로그 발행, 게시글 작성 시 호출
 */
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export async function submitIndexNow(urls: string[]) {
  if (!INDEXNOW_KEY || !urls.length) return;

  const payload = {
    host: new URL(SITE).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: urls.map(u => u.startsWith('http') ? u : `${SITE}${u}`),
  };

  // IndexNow는 하나의 엔드포인트에 제출하면 Bing/Yandex/Naver 등 모든 참여 엔진에 전파
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

/**
 * 네이버 서치어드바이저 — 사이트맵 ping
 */
export async function pingNaverSitemap() {
  try {
    await fetch(`https://searchadvisor.naver.com/indexnow?url=${encodeURIComponent(SITE + '/sitemap.xml')}`);
  } catch {}
}

/**
 * Google — sitemap ping (deprecated but still works)
 */
export async function pingGoogleSitemap() {
  try {
    await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITE + '/sitemap.xml')}`);
  } catch {}
}
