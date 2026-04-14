import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

export const maxDuration = 300;
export const runtime = 'nodejs';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const BATCH_SIZE = 15; // 현장 수 (× 5~6쿼리 = 75~90 API 호출)

// ━━━ 이미지 카테고리 정의 ━━━
const IMAGE_CATEGORIES = [
  { type: '조감도', queries: ['조감도', '전경'], display: 2 },
  { type: '투시도', queries: ['투시도', '외관'], display: 1 },
  { type: '단지배치도', queries: ['단지배치도', '배치도'], display: 1 },
  { type: '모델하우스', queries: ['모델하우스', '견본주택'], display: 2 },
  { type: '평면도', queries: ['평면도'], display: 1 },
] as const;

// ━━━ Phase 1: 네이버 부동산 API (비공식) ━━━
async function fetchNaverLandPhotos(name: string): Promise<{ url: string; thumb: string; type: string; source: string }[]> {
  try {
    // Step 1: 단지 검색 → complexNo
    const searchRes = await fetch(
      `https://m.land.naver.com/search/result/${encodeURIComponent(name)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Referer': 'https://m.land.naver.com/',
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!searchRes.ok) return [];
    const html = await searchRes.text();

    // complexNo 추출 (HTML에서 파싱)
    const complexMatch = html.match(/complexNo['":\s]+(\d{5,})/);
    if (!complexMatch) return [];
    const complexNo = complexMatch[1];

    // Step 2: 사진 갤러리 API
    const photoRes = await fetch(
      `https://new.land.naver.com/api/complexes/${complexNo}/photos?photoType=all&page=1&displayCount=20`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Referer': `https://new.land.naver.com/complexes/${complexNo}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!photoRes.ok) return [];
    const photoData = await photoRes.json();
    const photos = photoData?.photos || photoData?.photoList || [];
    if (!Array.isArray(photos) || photos.length === 0) return [];

    // 카테고리 매핑
    const typeMap: Record<string, string> = {
      'BIRD_VIEW': '조감도', 'PERSPECTIVE': '투시도', 'SITE_PLAN': '단지배치도',
      'MODEL_HOUSE': '모델하우스', 'FLOOR_PLAN': '평면도', 'EXTERIOR': '외관',
      'INTERIOR': '내부', 'ETC': '기타',
    };

    return photos.slice(0, 8).map((p: any) => ({
      url: p.photoUrl || p.url || p.imageUrl || '',
      thumb: p.thumbnailUrl || p.thumbnail || p.photoUrl || p.url || '',
      type: typeMap[p.photoType || p.type || ''] || p.photoTypeName || '기타',
      source: 'naver-land',
    })).filter((p: any) => p.url);
  } catch {
    return [];
  }
}

// ━━━ Phase 2: 네이버 이미지 검색 API (공식) ━━━
async function searchNaverImages(
  name: string,
  queryKeyword: string,
  count: number = 2
): Promise<{ url: string; thumb: string; type: string; source: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];

  try {
    const query = `${name} ${queryKeyword}`;
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${count}&sort=sim&filter=large`,
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
    const items = data?.items || [];

    return items
      .filter((item: any) => {
        // 너무 작은 이미지 제외
        const w = parseInt(item.sizewidth || '0');
        const h = parseInt(item.sizeheight || '0');
        return w >= 300 && h >= 200;
      })
      .slice(0, count)
      .map((item: any) => ({
        url: item.link || '',
        thumb: item.thumbnail || item.link || '',
        type: queryKeyword,
        source: 'naver-search',
      }));
  } catch {
    return [];
  }
}

// ━━━ 현장별 이미지 수집 (Phase 1 → Phase 2 fallback) ━━━
async function collectImagesForSite(name: string): Promise<{ url: string; thumb: string; type: string; source: string }[]> {
  // Phase 1: 네이버 부동산 사진 갤러리
  const landPhotos = await fetchNaverLandPhotos(name);
  if (landPhotos.length >= 4) {
    return landPhotos.slice(0, 8);
  }

  // Phase 2: 네이버 이미지 검색 (카테고리별)
  const searchResults: { url: string; thumb: string; type: string; source: string }[] = [...landPhotos];
  const seenUrls = new Set(landPhotos.map(p => p.url));
  const coveredTypes = new Set(landPhotos.map(p => p.type));

  for (const cat of IMAGE_CATEGORIES) {
    if (searchResults.length >= 7) break;
    // 이미 해당 카테고리가 있으면 스킵
    if (coveredTypes.has(cat.type)) continue;

    // 첫 번째 쿼리 시도
    let images = await searchNaverImages(name, cat.queries[0], cat.display);
    // 결과 없으면 대체 쿼리
    if (images.length === 0 && cat.queries.length > 1) {
      images = await searchNaverImages(name, cat.queries[1] as string, cat.display);
    }

    for (const img of images) {
      if (!seenUrls.has(img.url) && searchResults.length < 8) {
        searchResults.push({ ...img, type: cat.type });
        seenUrls.add(img.url);
      }
    }

    // 네이버 API rate limit 존중 — 50ms 딜레이
    await new Promise(r => setTimeout(r, 50));
  }

  return searchResults;
}

// ━━━ 메인 핸들러 ━━━
async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let processed = 0;
  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ error: 'NAVER API keys not set', processed: 0 }, { status: 200 });
  }

  try {
    // ━━━ Step 1: 이미지 없는 현장 조회 (우선순위: 최근 청약 > 분양중 > 재개발) ━━━
    const { data: sites } = await (sb as any).from('apt_sites')
      .select('id, slug, name, site_type, images, region, status')
      .is('images', null)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(BATCH_SIZE);

    const targetSites = (sites || []) as any[];

    if (targetSites.length === 0) {
      return NextResponse.json({
        message: '모든 현장에 이미지가 있습니다',
        processed: 0, created: 0, failed: 0,
        elapsed: `${Date.now() - start}ms`,
      }, { status: 200 });
    }

    // ━━━ Step 2: 각 현장별 이미지 수집 ━━━
    for (const site of targetSites) {
      try {
        const images = await collectImagesForSite(site.name);
        processed++;

        if (images.length === 0) {
          failed++;
          continue;
        }

        // ━━━ Step 3: DB 업데이트 ━━━
        const { error } = await (sb as any).from('apt_sites')
          .update({
            images: images,
            updated_at: new Date().toISOString(),
          })
          .eq('id', site.id);

        if (error) {
          errors.push(`${site.name}: DB update failed - ${error.message}`);
          failed++;
        } else {
          created++;
        }

        // 현장 간 딜레이 (300ms) — rate limit 방지
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        processed++;
        failed++;
        errors.push(`${site.name}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
  } catch (e) {
    errors.push(`main: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  return NextResponse.json({
    processed,
    created,
    failed,
    errors: errors.slice(0, 10),
    elapsed: `${Date.now() - start}ms`,
    metadata: { batch: BATCH_SIZE, categories: IMAGE_CATEGORIES.length },
  }, { status: 200 });
}

export const GET = withCronAuth(handler);
