// 임시 일회성 벌크 이미지 수집 엔드포인트 — 사용 후 삭제 예정
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

const ONE_TIME_TOKEN = 'f41f6717-5aff-4ff2-93d6-e9daf032689c';
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const CONCURRENT = 10; // 동시 처리 현장 수

const IMAGE_CATEGORIES = [
  { type: '조감도', queries: ['조감도', '전경'], display: 2 },
  { type: '투시도', queries: ['투시도', '외관'], display: 1 },
  { type: '단지배치도', queries: ['단지배치도', '배치도'], display: 1 },
  { type: '모델하우스', queries: ['모델하우스', '견본주택'], display: 2 },
  { type: '평면도', queries: ['평면도'], display: 1 },
] as const;

async function fetchNaverLandPhotos(name: string) {
  try {
    const searchRes = await fetch(
      `https://m.land.naver.com/search/result/${encodeURIComponent(name)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36', 'Referer': 'https://m.land.naver.com/' }, signal: AbortSignal.timeout(5000) }
    );
    if (!searchRes.ok) return [];
    const html = await searchRes.text();
    const complexMatch = html.match(/complexNo['\":\s]+(\d{5,})/);
    if (!complexMatch) return [];
    const complexNo = complexMatch[1];
    const photoRes = await fetch(
      `https://new.land.naver.com/api/complexes/${complexNo}/photos?photoType=all&page=1&displayCount=20`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': `https://new.land.naver.com/complexes/${complexNo}`, 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!photoRes.ok) return [];
    const photoData = await photoRes.json();
    const photos = photoData?.photos || photoData?.photoList || [];
    if (!Array.isArray(photos) || photos.length === 0) return [];
    const typeMap: Record<string, string> = { 'BIRD_VIEW': '조감도', 'PERSPECTIVE': '투시도', 'SITE_PLAN': '단지배치도', 'MODEL_HOUSE': '모델하우스', 'FLOOR_PLAN': '평면도', 'EXTERIOR': '외관', 'INTERIOR': '내부', 'ETC': '기타' };
    return photos.slice(0, 8).map((p: any) => ({ url: p.photoUrl || p.url || '', thumb: p.thumbnailUrl || p.photoUrl || '', type: typeMap[p.photoType || ''] || '기타', source: 'naver-land' })).filter((p: any) => p.url);
  } catch { return []; }
}

async function searchNaverImages(name: string, keyword: string, count: number) {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(name + ' ' + keyword)}&display=${count}&sort=sim&filter=large`,
      { headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.items || [])
      .filter((i: any) => parseInt(i.sizewidth || '0') >= 300 && parseInt(i.sizeheight || '0') >= 200)
      .slice(0, count)
      .map((i: any) => ({ url: i.link || '', thumb: i.thumbnail || i.link || '', type: keyword, source: 'naver-search' }));
  } catch { return []; }
}

async function collectImages(name: string) {
  const landPhotos = await fetchNaverLandPhotos(name);
  if (landPhotos.length >= 4) return landPhotos.slice(0, 8);

  const coveredTypes = new Set(landPhotos.map((p) => p.type));
  const catResults = await Promise.all(
    IMAGE_CATEGORIES.filter((c) => !coveredTypes.has(c.type)).map(async (cat) => {
      let imgs = await searchNaverImages(name, cat.queries[0], cat.display);
      if (imgs.length === 0 && cat.queries.length > 1) imgs = await searchNaverImages(name, cat.queries[1] as string, cat.display);
      return imgs.map((i) => ({ ...i, type: cat.type }));
    })
  );

  const seenUrls = new Set(landPhotos.map((p) => p.url));
  const result = [...landPhotos];
  for (const imgs of catResults) {
    for (const img of imgs) {
      if (!seenUrls.has(img.url) && result.length < 8) { result.push(img); seenUrls.add(img.url); }
    }
  }
  return result;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== ONE_TIME_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const offsetParam = parseInt(req.nextUrl.searchParams.get('offset') || '0');
  const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '200');

  const sb = getSupabaseAdmin();
  const { data: sites } = await (sb as any).from('apt_sites')
    .select('id, name')
    .is('images', null)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .range(offsetParam, offsetParam + limitParam - 1);

  const targets = (sites || []) as any[];
  if (targets.length === 0) return NextResponse.json({ message: '완료', processed: 0 });

  let created = 0, failed = 0;

  // CONCURRENT개씩 병렬 처리
  for (let i = 0; i < targets.length; i += CONCURRENT) {
    const chunk = targets.slice(i, i + CONCURRENT);
    await Promise.all(chunk.map(async (site: any) => {
      try {
        const images = await collectImages(site.name);
        if (images.length === 0) { failed++; return; }
        const { error } = await (sb as any).from('apt_sites').update({ images, updated_at: new Date().toISOString() }).eq('id', site.id);
        if (error) failed++; else created++;
      } catch { failed++; }
    }));
  }

  const { count } = await (sb as any).from('apt_sites').select('*', { count: 'exact', head: true }).is('images', null).eq('is_active', true);

  return NextResponse.json({ processed: targets.length, created, failed, remaining: count, offset: offsetParam });
}
