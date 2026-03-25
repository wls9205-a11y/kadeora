import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;

/**
 * 재개발 프로젝트 좌표 자동 수집 크론
 * - latitude/longitude NULL인 프로젝트 대상
 * - 카카오 로컬 API로 주소→좌표 변환
 * - 매주 목요일 04:30 KST
 */

async function geocodeKakao(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key || !address) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `KakaoAK ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch { return null; }
}

// 키워드 검색 폴백 (주소 매칭 실패 시)
async function geocodeKeyword(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key || !query) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `KakaoAK ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch { return null; }
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const sb = getSupabaseAdmin();

  const { data: projects } = await sb.from('redevelopment_projects')
    .select('id, district_name, region, sigungu, address')
    .eq('is_active', true)
    .or('latitude.is.null,longitude.is.null')
    .limit(40);

  if (!projects?.length) {
    return NextResponse.json({ ok: true, message: '좌표 미수집 프로젝트 없음', updated: 0 });
  }

  let updated = 0;
  let failed = 0;

  for (const p of projects) {
    // 1차: 주소로 지오코딩
    let coords = p.address ? await geocodeKakao(p.address) : null;

    // 2차: 구역명 + 지역으로 키워드 검색
    if (!coords) {
      const query = `${p.region || ''} ${p.sigungu || ''} ${p.district_name}`;
      coords = await geocodeKeyword(query.trim());
    }

    if (coords && coords.lat > 33 && coords.lat < 39 && coords.lng > 124 && coords.lng < 132) {
      const { error } = await sb.from('redevelopment_projects')
        .update({ latitude: coords.lat, longitude: coords.lng } as any)
        .eq('id', p.id);
      if (!error) updated++;
      else failed++;
    } else {
      failed++;
    }

    // API 과부하 방지
    await new Promise(r => setTimeout(r, 200));
  }

  console.info(`[redev-geocode] redev: scanned=${projects.length} updated=${updated} failed=${failed}`);

  // ━━━ Phase 2: apt_sites 좌표 수집 (좌표 없는 현장) ━━━
  let siteUpdated = 0;
  let siteFailed = 0;

  const { data: sites } = await sb.from('apt_sites')
    .select('id, name, region, sigungu, address')
    .eq('is_active', true)
    .is('latitude', null)
    .order('content_score', { ascending: false })
    .limit(150);

  for (const s of (sites || [])) {
    // 1차: 주소로 지오코딩
    let coords = s.address ? await geocodeKakao(s.address) : null;

    // 2차: 이름 + 지역으로 키워드 검색
    if (!coords) {
      const query = `${s.region || ''} ${s.sigungu || ''} ${s.name} 아파트`;
      coords = await geocodeKeyword(query.trim());
    }

    if (coords && coords.lat > 33 && coords.lat < 39 && coords.lng > 124 && coords.lng < 132) {
      const { error } = await sb.from('apt_sites')
        .update({ latitude: coords.lat, longitude: coords.lng, updated_at: new Date().toISOString() })
        .eq('id', s.id);
      if (!error) siteUpdated++;
      else siteFailed++;
    } else {
      siteFailed++;
    }

    await new Promise(r => setTimeout(r, 150));
  }

  console.info(`[redev-geocode] sites: scanned=${(sites || []).length} updated=${siteUpdated} failed=${siteFailed}`);
  return NextResponse.json({ ok: true, redev: { scanned: projects.length, updated, failed }, sites: { scanned: (sites || []).length, updated: siteUpdated, failed: siteFailed } });
});
