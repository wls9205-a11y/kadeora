import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

export const maxDuration = 300;
export const runtime = 'nodejs';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const BATCH_SIZE = 30; // 현장 수 — Vercel 300s 제한 내 안전 처리 (매시간 실행)
const TARGET_IMG_COUNT = 7; // 목표 이미지 수
const MIN_IMG_COUNT = 3; // 이하면 재크롤 대상
const MAX_RUNTIME_MS = 250_000; // 250초 — 300초 제한에 여유 50초

// ━━━ 도메인 블랙리스트 (경쟁사 + 관련성 낮은 출처) ━━━
const DOMAIN_BLACKLIST = [
  /hogangnono/i,                       // 호갱노노 (경쟁사)
  /new\.land\.naver\.com|landthumb/i,  // 네이버부동산 (경쟁사)
  /kbland|kbstar\.com/i,               // KB부동산 (경쟁사)
  /zigbang|dabang/i,                   // 직방·다방 (경쟁사)
  /dcinside\.(com|co\.kr)/i,           // 디시인사이드 전체 (부적합)
  /i\.pinimg\.com|ruliweb\.com/i,      // Pinterest·루리웹 (관련성 낮음)
  /namu\.wiki/i,                       // 나무위키
  /ppomppu\.co\.kr/i,                  // 뽐뿌 (커뮤니티 무관 이미지)
  /shop\d*\.phinf\.naver\.net/i,       // 네이버 쇼핑 (부적합)
  /\.gif(\?|$)/i,                      // 움짤 제외
];

function isBlacklisted(url: string): boolean {
  if (!url) return true;
  return DOMAIN_BLACKLIST.some((re) => re.test(url));
}

// ━━━ 이미지 카테고리 정의 ━━━
const IMAGE_CATEGORIES = [
  { type: '조감도', queries: ['조감도', '전경'], display: 2 },
  { type: '투시도', queries: ['투시도', '외관'], display: 1 },
  { type: '단지배치도', queries: ['단지배치도', '배치도'], display: 1 },
  { type: '모델하우스', queries: ['모델하우스', '견본주택'], display: 2 },
  { type: '평면도', queries: ['평면도'], display: 1 },
] as const;

// ━━━ 관련성 검증: 네이버 검색 결과 title과 단지명 매칭 ━━━
function normalizeForMatch(s: string): string {
  return (s || '')
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/&[a-z]+;/g, '') // 엔티티 제거
    .replace(/[\s\-·,.()\[\]【】「」『』'"·]/g, '')
    .toLowerCase();
}

/**
 * 단지명의 핵심 토큰을 추출 (최소 2자 이상 한글/영문 연속 덩어리).
 * 예: "래미안 원베일리" → ["래미안", "원베일리"]
 * 예: "SK뷰" → ["sk뷰"] (전체) / "푸르지오써밋" → ["푸르지오써밋"]
 */
function extractNameTokens(name: string): string[] {
  const normalized = (name || '').replace(/\s+/g, ' ').trim();
  // 2자 이상 의미있는 덩어리 뽑기
  const tokens = normalized
    .split(/[\s\-·,.()\[\]]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return tokens.length > 0 ? tokens : [normalized];
}

/** title/alt 속 단지명 토큰 포함 여부 (핵심 토큰 1개라도 있으면 관련) */
function isRelevantToSite(title: string, siteName: string): boolean {
  const t = normalizeForMatch(title);
  if (!t) return false;
  const tokens = extractNameTokens(siteName);
  // 토큰 중 하나라도 title에 포함되면 관련
  for (const tok of tokens) {
    const ntok = normalizeForMatch(tok);
    if (ntok.length >= 2 && t.includes(ntok)) return true;
  }
  return false;
}

// ━━━ Phase 1: 네이버 부동산 API (비공식) — 단지 사진 갤러리 ━━━
async function fetchNaverLandPhotos(
  name: string
): Promise<{ url: string; thumb: string; type: string; source: string; caption: string }[]> {
  try {
    const searchRes = await fetch(
      `https://m.land.naver.com/search/result/${encodeURIComponent(name)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          Referer: 'https://m.land.naver.com/',
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!searchRes.ok) return [];
    const html = await searchRes.text();

    const complexMatch = html.match(/complexNo['":\s]+(\d{5,})/);
    if (!complexMatch) return [];
    const complexNo = complexMatch[1];

    const photoRes = await fetch(
      `https://new.land.naver.com/api/complexes/${complexNo}/photos?photoType=all&page=1&displayCount=20`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          Referer: `https://new.land.naver.com/complexes/${complexNo}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!photoRes.ok) return [];
    const photoData = await photoRes.json();
    const photos = photoData?.photos || photoData?.photoList || [];
    if (!Array.isArray(photos) || photos.length === 0) return [];

    const typeMap: Record<string, string> = {
      BIRD_VIEW: '조감도',
      PERSPECTIVE: '투시도',
      SITE_PLAN: '단지배치도',
      MODEL_HOUSE: '모델하우스',
      FLOOR_PLAN: '평면도',
      EXTERIOR: '외관',
      INTERIOR: '내부',
      ETC: '기타',
    };

    // ⚠️ land.naver API 결과 자체는 경쟁사 도메인이지만, complexNo로 직접 가져온 정식 단지 사진이므로
    //   CDN 도메인(phinf.pstatic.net 등)으로 리다이렉트 되면 허용. 단, new.land.naver.com 도메인 링크는 제외.
    return photos
      .slice(0, 10)
      .map((p: any) => {
        const url = p.photoUrl || p.url || p.imageUrl || '';
        const type = typeMap[p.photoType || p.type || ''] || p.photoTypeName || '기타';
        return {
          url,
          thumb: p.thumbnailUrl || p.thumbnail || url,
          type,
          source: 'naver-land',
          caption: `${name} — ${type}`,
        };
      })
      .filter((p: any) => p.url && !isBlacklisted(p.url));
  } catch {
    return [];
  }
}

// ━━━ Phase 2: 네이버 이미지 검색 API (공식) — 관련성 검증 포함 ━━━
async function searchNaverImages(
  siteName: string,
  queryKeyword: string,
  region: string,
  count: number = 3
): Promise<{ url: string; thumb: string; type: string; source: string; caption: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];

  try {
    // region을 쿼리에 섞어서 정확도 향상 (단, 단지명이 이미 지역을 포함하면 생략)
    const needsRegion = region && !siteName.includes(region);
    const query = needsRegion
      ? `${siteName} ${queryKeyword} ${region}`
      : `${siteName} ${queryKeyword}`;

    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(
        query
      )}&display=10&sort=sim&filter=large`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.items || [];

    return items
      .filter((item) => {
        // 크기
        const w = parseInt(item.sizewidth || '0');
        const h = parseInt(item.sizeheight || '0');
        if (w < 400 || h < 250) return false;
        // 블랙리스트
        if (isBlacklisted(item.link || '')) return false;
        // 관련성 — title에 단지명 토큰 있어야 함
        if (!isRelevantToSite(item.title || '', siteName)) return false;
        return true;
      })
      .slice(0, count)
      .map((item) => ({
        url: (item.link || '').replace(/^http:\/\//, 'https://'),
        thumb: (item.thumbnail || item.link || '').replace(/^http:\/\//, 'https://'),
        type: queryKeyword,
        source: 'naver-search',
        caption: `${siteName} — ${queryKeyword}`,
      }));
  } catch {
    return [];
  }
}

// ━━━ 글로벌 중복 URL 세트 (같은 세션 내 중복 방지) ━━━
async function fetchGlobalUsedUrls(sb: any): Promise<Set<string>> {
  // 이미 3+ 사이트에 쓰인 URL은 재할당하지 않도록 방어
  try {
    const { data, error } = await sb.rpc('get_overused_apt_image_urls', { min_dup: 3 });
    if (error) {
      console.warn('[apt-image-crawl] overused RPC error:', error.message);
      return new Set<string>();
    }
    if (Array.isArray(data)) return new Set(data.map((r: any) => r.url).filter(Boolean));
  } catch (e) {
    console.warn('[apt-image-crawl] overused RPC exception:', e);
  }
  return new Set<string>();
}

// ━━━ 현장별 이미지 수집: Phase 1 → Phase 2 ━━━
async function collectImagesForSite(
  name: string,
  region: string,
  globalUsed: Set<string>
): Promise<{ url: string; thumb: string; type: string; source: string; caption: string }[]> {
  const results: { url: string; thumb: string; type: string; source: string; caption: string }[] = [];
  const seenUrls = new Set<string>();

  const push = (img: { url: string; thumb: string; type: string; source: string; caption: string }) => {
    const u = (img.url || '').replace(/^http:\/\//, 'https://');
    if (!u) return;
    if (seenUrls.has(u)) return;
    if (globalUsed.has(u)) return; // 글로벌 과다사용 URL 차단
    if (isBlacklisted(u)) return;
    seenUrls.add(u);
    results.push({ ...img, url: u });
  };

  // Phase 1: 네이버 부동산 단지 사진
  const landPhotos = await fetchNaverLandPhotos(name);
  for (const p of landPhotos) {
    push(p);
    if (results.length >= TARGET_IMG_COUNT) break;
  }

  if (results.length >= TARGET_IMG_COUNT) return results.slice(0, TARGET_IMG_COUNT);

  // Phase 2: 카테고리별 이미지 검색 (관련성 검증 포함)
  const coveredTypes = new Set(results.map((p) => p.type));
  for (const cat of IMAGE_CATEGORIES) {
    if (results.length >= TARGET_IMG_COUNT) break;
    if (coveredTypes.has(cat.type)) continue;

    let imgs = await searchNaverImages(name, cat.queries[0], region, cat.display);
    if (imgs.length === 0 && cat.queries.length > 1) {
      imgs = await searchNaverImages(name, cat.queries[1] as string, region, cat.display);
    }
    for (const img of imgs) {
      push({ ...img, type: cat.type });
      if (results.length >= TARGET_IMG_COUNT) break;
    }
  }

  return results.slice(0, TARGET_IMG_COUNT);
}

// ━━━ 메인 핸들러 ━━━
async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let processed = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ error: 'NAVER API keys not set', processed: 0 }, { status: 200 });
  }

  try {
    // 글로벌 과다사용 URL 조회 (경계 넘은 것들 방어)
    const globalUsed = await fetchGlobalUsedUrls(sb);

    // ━━━ Step 1: 이미지 부족 현장 조회 (RPC — PostgREST는 jsonb_array_length 필터 불가) ━━━
    // 우선순위: NULL/빈배열 → 1~2장 (MIN_IMG_COUNT=3 미만 전부), updated_at 오래된 것 먼저
    const { data: sites, error: sitesErr } = await (sb as any).rpc(
      'get_apt_sites_needing_images',
      { min_img_count: MIN_IMG_COUNT, batch_size: BATCH_SIZE }
    );
    if (sitesErr) {
      return NextResponse.json(
        { error: `RPC fail: ${sitesErr.message}`, processed: 0 },
        { status: 200 }
      );
    }

    const targetSites = (sites || []) as any[];

    if (targetSites.length === 0) {
      return NextResponse.json(
        {
          message: '모든 현장 이미지 3장 이상 확보',
          processed: 0,
          created: 0,
          updated: 0,
          failed: 0,
          elapsed: `${Date.now() - start}ms`,
        },
        { status: 200 }
      );
    }

    // ━━━ Step 2: 각 현장별 이미지 수집 ━━━
    for (const site of targetSites) {
      // 타임아웃 가드 — Vercel 300s 제한 안전 마진
      if (Date.now() - start > MAX_RUNTIME_MS) {
        errors.push(`timeout guard: ${processed} processed, stopping early`);
        break;
      }
      try {
        const region = site.region || '';
        const existing = Array.isArray(site.images) ? site.images : [];
        const isEmpty = existing.length === 0;

        const images = await collectImagesForSite(site.name, region, globalUsed);
        processed++;

        if (images.length === 0) {
          failed++;
          continue;
        }

        // 부분 수집된 것도 기존 것보다 많으면 업데이트
        if (images.length <= existing.length) {
          // 새로 얻은 게 더 적으면 기존 + 새 것 합치기 (중복 제거)
          const merged: any[] = [...existing];
          const seenU = new Set(merged.map((x: any) => x?.url));
          for (const ni of images) {
            if (!seenU.has(ni.url) && merged.length < TARGET_IMG_COUNT) {
              merged.push(ni);
              seenU.add(ni.url);
            }
          }
          if (merged.length <= existing.length) {
            failed++;
            continue;
          }
          const { error } = await (sb as any)
            .from('apt_sites')
            .update({ images: merged, updated_at: new Date().toISOString() })
            .eq('id', site.id);
          if (error) {
            errors.push(`${site.name}: ${error.message}`);
            failed++;
          } else {
            isEmpty ? created++ : updated++;
          }
        } else {
          // 새로 얻은 게 더 많음 → 교체
          const { error } = await (sb as any)
            .from('apt_sites')
            .update({ images, updated_at: new Date().toISOString() })
            .eq('id', site.id);
          if (error) {
            errors.push(`${site.name}: ${error.message}`);
            failed++;
          } else {
            isEmpty ? created++ : updated++;
          }
        }

        // 새로 얻은 URL은 globalUsed에 추가 (같은 배치 내 중복 방지)
        for (const img of images) globalUsed.add(img.url);

        await new Promise((r) => setTimeout(r, 150));
      } catch (e) {
        processed++;
        failed++;
        errors.push(`${site.name}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
  } catch (e) {
    errors.push(`main: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  return NextResponse.json(
    {
      processed,
      created,
      updated,
      failed,
      errors: errors.slice(0, 10),
      elapsed: `${Date.now() - start}ms`,
      metadata: { batch: BATCH_SIZE, target: TARGET_IMG_COUNT, min: MIN_IMG_COUNT },
    },
    { status: 200 }
  );
}

export const GET = withCronAuth(handler);
