/**
 * IndexNow — Bing/Yandex/Naver에 URL 즉시 색인 요청
 * 블로그 발행, 게시글 작성 시 호출
 */
// 호스팅된 IndexNow 키 (public/3a23def313e1b1283822c54a0f9a5675.txt = 200).
// env 미설정 시 no-op 되던 게 indexnow-urgent/batch 71일 무제출의 원인 → 실측 검증된
// 호스팅 키를 fallback 으로. (api.indexnow.org / bing 200 확인, naver 422 는 포털측 이슈)
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '3a23def313e1b1283822c54a0f9a5675';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export interface IndexNowResult {
  ok: boolean;       // 하나 이상의 포털이 수락(2xx)
  accepted: number;  // 수락한 (batch×endpoint) 수
  attempted: number; // 시도한 (batch×endpoint) 수
}

export async function submitIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (!INDEXNOW_KEY || !urls.length) return { ok: false, accepted: 0, attempted: 0 };

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

  let accepted = 0;
  let attempted = 0;
  for (const batch of batches) {
    const payload = {
      host: new URL(SITE).hostname,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: batch,
    };

    const settled = await Promise.allSettled(
      endpoints.map(ep =>
        // 504 hotfix: per-fetch timeout — 포털 hang 이 함수 maxDuration 을 잡아먹지 않도록
        fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        })
      )
    );
    for (const s of settled) {
      attempted++;
      if (s.status === 'fulfilled' && (s.value.ok || s.value.status === 200 || s.value.status === 202)) accepted++;
    }
    // 배치 간 200ms 딜레이 (rate limit 방지)
    if (batches.length > 1) await new Promise(r => setTimeout(r, 200));
  }
  return { ok: accepted > 0, accepted, attempted };
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
