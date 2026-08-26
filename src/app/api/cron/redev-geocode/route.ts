import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { assertCoordInRegion } from '@/lib/geo/region-bbox';

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
      // ⚠️ 주소만 던지면 «동명 시군구» 로 간다. 「서구 ○○로 12」는 부산 서구도 대전 서구도
      //    맞는 말이라 카카오가 가장 그럴듯한 다른 도를 돌려준다. 이게 오염 687건의 원인이다.
      //    반드시 시도를 앞에 붙인다 — 「부산 서구 ○○로 12」.
      const addrQ = p.address ? `${p.region || ''} ${p.address}`.trim() : '';
      let coords = addrQ ? await geocodeKakao(addrQ) : null;
      if (!coords) {
        const q = `${p.region || ''} ${p.sigungu || ''} ${p.district_name}`;
        coords = await geocodeKeyword(q.trim());
      }
      if (!coords) {
        const q = `${p.region || ''} ${p.sigungu || ''} ${p.district_name} 재개발`;
        coords = await geocodeNaver(q.trim());
      }
      // ⚠️ 전국 박스(33~39/124~132)는 «다른 도» 를 전부 통과시킨다. 시도 bbox 로 건다.
      const g = coords ? assertCoordInRegion(p.region, coords.lat, coords.lng, `redev-geocode:${p.id}`) : null;
      if (g?.ok && g.lat != null && g.lng != null) {
        const { error } = await sb.from('redevelopment_projects')
          // @ts-expect-error supabase update type
          .update({ latitude: g.lat, longitude: g.lng })
          .eq('id', p.id);
        if (error) console.error('[redev-geocode] insert fail', error.message?.slice(0, 200));
        else redevUpdated++;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // ━━━ Phase 2: apt_sites 좌표 ━━━
    // ⚠️ 정비사업에서 가져온 주소는 지오코딩하지 않는다.
    //    redevelopment_projects.address 는 상당수가 «조합 사무실» 이다 —
    //    `못골번영로 16, 흥원빌딩 3층` · `달맞이길117번나길 194, 1동 지하1층` · `용호로 99, 3층`.
    //    사업지가 아니라 사무실 자리에 핀이 서므로 «좌표가 없는 것보다 나쁘다».
    //    그런 행에는 source_ids.address_source='redev' 표식이 있다 — 실측 136곳
    //    (R2-2 가 채운 92 + 예전 sync-apt-sites INSERT 경로가 채운 44를 백필).
    //    44곳은 주소가 redevelopment_projects 것과 «정확히 일치» 하는 것만 골랐다.
    //    redev_id 가 있다는 것만으로 붙이면 청약홈 주소를 잘못 막는다.
    //    ⛔ 이 필터를 빼지 말 것. 빼면 그 136곳에 조합 사무실 좌표가 박힌다.
    const { data: sites } = await sb.from('apt_sites')
      .select('id, name, region, sigungu, address')
      .eq('is_active', true)
      .is('latitude', null)
      // ⛔ `.not(col, 'eq', 'redev')` 를 쓰지 말 것. PostgREST 가 `NOT (col = 'redev')` 로
      //    번역하는데 SQL 3값 논리에서 col 이 NULL 이면 그 식이 TRUE 가 아니라 «NULL» 이라
      //    표식 없는 행까지 «전부» 걸러진다. 실측으로 좌표 없음 273행 중 크론이 보는 행이
      //    0 이 됐다 — 92곳을 막으려다 지오코딩 경로를 통째로 죽였다.
      //    더 나쁜 건 조용하다는 것이다: 로그에 `0 scanned` 가 찍혀 「할 일이 없다」와
      //    「필터가 깨졌다」가 구분되지 않는다.
      //    아래 or() 가 `IS DISTINCT FROM 'redev'` 와 같은 뜻이다.
      .or('source_ids->>address_source.is.null,source_ids->>address_source.neq.redev')
      .order('content_score', { ascending: false })
      .limit(300);

    let siteUpdated = 0;
    let siteFailed = 0;
    let firstError = '';

    for (const s of (sites || [])) {
      // 1차: 카카오 주소
      // ⚠️ Phase 1 과 같은 이유로 시도를 앞에 붙인다. 주소만 던지면 동명 시군구로 간다.
      const sAddrQ = s.address ? `${s.region || ''} ${s.address}`.trim() : '';
      let coords = sAddrQ ? await geocodeKakao(sAddrQ) : null;

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

      const g2 = coords ? assertCoordInRegion(s.region, coords.lat, coords.lng, `site-geocode:${s.id}`) : null;
      if (g2?.ok && g2.lat != null && g2.lng != null) {
        const { error } = await sb.from('apt_sites')
          .update({ latitude: g2.lat, longitude: g2.lng, updated_at: new Date().toISOString() })
          .eq('id', s.id);
        if (error) console.error('[redev-geocode] insert fail', error.message?.slice(0, 200));
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
