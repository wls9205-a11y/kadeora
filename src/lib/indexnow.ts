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
 * 제출 성공한 pending 행들을 status='submitted' 로 마킹 + UNIQUE(url,status) dedup.
 *
 * ⚠️ 청크 필수: `.in('url', [...])` / `.in('id', [...])` 는 GET 쿼리스트링이라 500개 긴 URL 을
 * 한 번에 넣으면 PostgREST URI 길이 한도(~8KB)를 넘겨 조용히 빈 결과가 된다(2026-07-18 batch
 * 500 에서 dedup 조회가 통째로 실패 → 충돌 UPDATE 원자 실패 → 드레인 0). 50개씩 처리한다.
 *
 * dedup(옵션 A): 같은 url 이 이미 'submitted' 로 있으면(쌍둥이) 이 pending 은 색인상 중복이라
 * UPDATE 대신 삭제. 나머지 fresh 만 submitted 로 UPDATE. 실제 처리 건수를 반환한다.
 */
export async function markIndexNowSubmitted(
  admin: any,
  rows: { id: unknown; url: string }[],
): Promise<{ submitted: number; deduped: number }> {
  const nowIso = new Date().toISOString();
  const CHUNK = 50; // 긴 URL × 50 ≈ 5KB < PostgREST URI 한도
  let submitted = 0;
  let deduped = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const chunkUrls = chunk.map((r) => r.url);

    const { data: twins, error: twinErr } = await admin
      .from('indexnow_queue')
      .select('url')
      .eq('status', 'submitted')
      .in('url', chunkUrls);
    if (twinErr) {
      console.error('[indexnow] twin lookup failed:', twinErr.message);
      continue; // 이 청크만 스킵 (다음 실행에서 재시도)
    }

    const twinUrls = new Set((twins || []).map((t: { url: string }) => t.url));
    const dupIds = chunk.filter((r) => twinUrls.has(r.url)).map((r) => r.id);
    const freshIds = chunk.filter((r) => !twinUrls.has(r.url)).map((r) => r.id);

    if (freshIds.length) {
      const { error } = await admin
        .from('indexnow_queue')
        .update({ status: 'submitted', submitted_at: nowIso, response_code: 200, attempt_count: 1 })
        .in('id', freshIds);
      if (error) console.error('[indexnow] submitted update failed:', error.message);
      else submitted += freshIds.length;
    }
    if (dupIds.length) {
      const { error } = await admin.from('indexnow_queue').delete().in('id', dupIds);
      if (error) console.error('[indexnow] dedup delete failed:', error.message);
      else deduped += dupIds.length;
    }
  }
  return { submitted, deduped };
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
