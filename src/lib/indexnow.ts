/**
 * IndexNow — Bing/Yandex/Naver에 URL 즉시 색인 요청
 * 블로그 발행, 게시글 작성 시 호출
 */
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export async function submitIndexNow(urls: string[]) {
  if (!INDEXNOW_KEY || !urls.length) return;

  const fullUrls = urls.map(u => u.startsWith('http') ? u : `${SITE}${u}`);

  const payload = {
    host: new URL(SITE).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: fullUrls.slice(0, 100), // IndexNow 최대 100개
  };

  // 1) IndexNow 통합 엔드포인트 (Bing/Yandex/Naver 등 모든 참여 엔진에 전파)
  const endpoints = [
    'https://api.indexnow.org/indexnow',
    'https://searchadvisor.naver.com/indexnow', // 네이버 직접
    'https://www.bing.com/indexnow',             // Bing 직접
  ];

  await Promise.allSettled(
    endpoints.map(ep =>
      fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      }).catch(() => {})
    )
  );
}

/**
 * 단일 URL IndexNow — 개별 포스트 발행 시
 */
export async function submitIndexNowSingle(path: string) {
  return submitIndexNow([path]);
}

/**
 * 네이버 서치어드바이저 — 사이트맵 ping
 */
export async function pingNaverSitemap() {
  try {
    await Promise.allSettled([
      fetch(`https://searchadvisor.naver.com/indexnow?url=${encodeURIComponent(SITE + '/sitemap.xml')}`),
      fetch(`https://searchadvisor.naver.com/indexnow?url=${encodeURIComponent(SITE + '/image-sitemap.xml')}`),
    ]);
  } catch {}
}

/**
 * Google — sitemap ping
 */
export async function pingGoogleSitemap() {
  try {
    await Promise.allSettled([
      fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITE + '/sitemap.xml')}`),
      fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITE + '/image-sitemap.xml')}`),
    ]);
  } catch {}
}

/**
 * 전체 포털 sitemap ping (Naver + Google + Bing)
 */
export async function pingAllSitemaps() {
  await Promise.allSettled([
    pingNaverSitemap(),
    pingGoogleSitemap(),
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(SITE + '/sitemap.xml')}`).catch(() => {}),
  ]);
}
