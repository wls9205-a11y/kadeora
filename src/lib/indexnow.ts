/**
 * IndexNow — Bing/Yandex/Naver에 URL 즉시 색인 요청
 * 블로그 발행, 게시글 작성 시 호출
 */
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export async function submitIndexNow(urls: string[]) {
  if (!INDEXNOW_KEY || !urls.length) return;

  const fullUrls = urls.map(u => u.startsWith('http') ? u : `${SITE}${u}`);

  // IndexNow 최대 10,000개/요청이지만 안전하게 500개씩 배치
  const BATCH_SIZE = 500;
  const batches: string[][] = [];
  for (let i = 0; i < fullUrls.length; i += BATCH_SIZE) {
    batches.push(fullUrls.slice(i, i + BATCH_SIZE));
  }

  const endpoints = [
    'https://api.indexnow.org/indexnow',
    'https://searchadvisor.naver.com/indexnow',
    'https://www.bing.com/indexnow',
  ];

  for (const batch of batches) {
    const payload = {
      host: new URL(SITE).hostname,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: batch,
    };

    await Promise.allSettled(
      endpoints.map(ep =>
        fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      )
    );
    // 배치 간 200ms 딜레이 (rate limit 방지)
    if (batches.length > 1) await new Promise(r => setTimeout(r, 200));
  }
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
 * Google sitemap ping — NOTE: google.com/ping은 2023년 deprecated됨
 * Google Search Console Indexing API 또는 sitemap 제출이 올바른 방법.
 * 여기서는 Bing/Naver ping만 실행. Google은 Search Console에서 관리.
 */
export async function pingGoogleSitemap() {
  // Google의 /ping?sitemap= 엔드포인트는 2023년 6월 deprecated.
  // 참고: https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping
  // Google은 sitemap을 자체 크롤링 스케줄로 발견하며, Search Console에서 직접 제출 권장.
  // 따라서 여기서는 no-op. Search Console URL 검사 API 연동은 별도 구현 필요.
}

/**
 * 전체 포털 sitemap ping (Naver + Bing)
 */
export async function pingAllSitemaps() {
  await Promise.allSettled([
    pingNaverSitemap(),
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(SITE + '/sitemap.xml')}`).catch(() => {}),
  ]);
}
