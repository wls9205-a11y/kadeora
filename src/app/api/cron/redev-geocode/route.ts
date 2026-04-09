import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 180;

/**
 * 재개발 + apt_sites 좌표 자동 수집 크론
 * - 카카오 주소→좌표 → 카카오 키워드 → Naver 키워드 (3단 폴백)
 * - 매일 05:15, 17:15 UTC
 */

async function geocodeKakao(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key || !address) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `KakaoAK ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[geocode] Kakao address API ${res.status} for: ${address.slice(0, 30)}`);
      return null;
    }
    const data = await res.json();
    const doc = data?.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch (e) {
    console.error(`[geocode] Kakao address error: ${e instanceof Error ? e.message : 'unknown'}`);
    return null;
  }
}

async function geocodeKeyword(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key || !query) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `KakaoAK ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[geocode] Kakao keyword API ${res.status} for: ${query.slice(0, 30)}`);
      return null;
    }
    const data = await res.json();
    const doc = data?.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch { return null; }
}

// Naver 키워드 검색 → mapx/mapy는 경도/위도를 10으로 나눈 정수 (126.97 → 1269700)
async function geocodeNaver(query: string): Promise<{ lat: number; lng: number } | null> {
  const cid = process.env.NAVER_CLIENT_ID;
  const csec = process.env.NAVER_CLIENT_SECRET;
  if (!cid || !csec || !query) return null;
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=1`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': cid, 'X-Naver-Client-Secret': csec },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[geocode] Naver API ${res.status} for: ${query.slice(0, 30)}`);
      return null;
    }
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item?.mapx || !item?.mapy) return null;
    // Naver Local: mapx=1269735 → 126.9735, mapy=373285 → 37.3285
    const rawX = parseInt(item.mapx);
    const rawY = parseInt(item.mapy);
    let lng: number, lat: number;
    if (rawX > 1000000000) { lng = rawX / 10000000; lat = rawY / 10000000; }
    else if (rawX > 1000000) { lng = rawX / 10000; lat = rawY / 10000; }
    else { lng = rawX; lat = rawY; }
    if (lat > 33 && lat < 39 && lng > 124 && lng < 132) return { lat, lng };
    console.error(`[geocode] Naver coords out of range: ${lat}, ${lng} (raw ${rawY}, ${rawX})`);
    return null;
  } catch { return null; }
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('redev-geocode', async () => {
    const sb = getSupabaseAdmin();
    const kakaoKey = process.env.KAKAO_REST_API_KEY;
    const naverCid = process.env.NAVER_CLIENT_ID;
    console.info(`[redev-geocode] keys: kakao=${kakaoKey ? 'SET' : 'MISSING'} naver=${naverCid ? 'SET' : 'MISSING'}`);

    // ━━━ Phase 1: 재개발 프로젝트 좌표 ━━━
    // random() 정렬로 매 실행마다 다른 프로젝트 시도 (실패 재시도 루프 방지)
    let projects: any[] | null = null;
    try { const r = await (sb as any).rpc('get_redev_no_coords', { lim: 40 }); projects = r.data; } catch {}
    // 폴백: RPC 없으면 기존 쿼리
    const redevTargets = projects || (await sb.from('redevelopment_projects')
      .select('id, district_name, region, sigungu, address')
      .eq('is_active', true)
      .or('latitude.is.null,longitude.is.null')
      .limit(40)).data || [];

    let redevUpdated = 0;
    for (const p of redevTargets) {
      let coords = p.address ? await geocodeKakao(p.address) : null;
      if (!coords) {
        const q = `${p.region || ''} ${p.sigungu || ''} ${p.district_name}`;
        coords = await geocodeKeyword(q.trim());
      }
      if (!coords) {
        const q = `${p.region || ''} ${p.sigungu || ''} ${p.district_name} 재개발`;
        coords = await geocodeNaver(q.trim());
      }
      if (coords && coords.lat > 33 && coords.lat < 39 && coords.lng > 124 && coords.lng < 132) {
        const { error } = await sb.from('redevelopment_projects')
          // @ts-expect-error supabase update type
          .update({ latitude: coords.lat, longitude: coords.lng })
          .eq('id', p.id);
        if (!error) redevUpdated++;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // ━━━ Phase 2: apt_sites 좌표 ━━━
    const { data: sites } = await sb.from('apt_sites')
      .select('id, name, region, sigungu, address')
      .eq('is_active', true)
      .is('latitude', null)
      .order('content_score', { ascending: false })
      .limit(300);

    let siteUpdated = 0;
    let siteFailed = 0;
    let firstError = '';

    for (const s of (sites || [])) {
      // 1차: 카카오 주소
      let coords = s.address ? await geocodeKakao(s.address) : null;

      // 2차: 카카오 키워드
      if (!coords) {
        const q = `${s.region || ''} ${s.sigungu || ''} ${s.name} 아파트`;
        coords = await geocodeKeyword(q.trim());
      }

      // 3차: 네이버 로컬
      if (!coords) {
        const q = `${s.region || ''} ${s.sigungu || ''} ${s.name}`;
        coords = await geocodeNaver(q.trim());
      }

      if (coords && coords.lat > 33 && coords.lat < 39 && coords.lng > 124 && coords.lng < 132) {
        const { error } = await sb.from('apt_sites')
          .update({ latitude: coords.lat, longitude: coords.lng, updated_at: new Date().toISOString() })
          .eq('id', s.id);
        if (!error) siteUpdated++;
        else { siteFailed++; if (!firstError) firstError = `DB: ${error.message}`; }
      } else {
        siteFailed++;
        if (!firstError) firstError = `No coords for: ${s.name}`;
      }

      await new Promise(r => setTimeout(r, 150));
    }

    console.info(`[redev-geocode] redev=${redevUpdated}/${redevTargets.length} sites=${siteUpdated}/${(sites || []).length} failed=${siteFailed}`);

    return {
      processed: redevTargets.length + (sites || []).length,
      created: redevUpdated + siteUpdated,
      updated: redevUpdated + siteUpdated,
      failed: siteFailed,
      metadata: {
        redev: { scanned: redevTargets.length, updated: redevUpdated },
        sites: { scanned: (sites || []).length, updated: siteUpdated, failed: siteFailed },
        firstError: firstError || undefined,
      },
    };
  });

  if (!result.success) return NextResponse.json({ ok: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
});
