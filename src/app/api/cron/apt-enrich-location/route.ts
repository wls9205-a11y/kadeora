import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

/**
 * ⛔ 2026-08-29 실측 — 이 함수가 실패를 «삼켰다».
 *    카카오가 403 `App(카더라) disabled OPEN_MAP_AND_LOCAL service` 를 돌려주는데
 *    `if (!res.ok) return null` 이라 「근처에 없다」와 구분되지 않았고,
 *    그 결과 이 크론이 «8/24~8/29 엿새 동안» processed 100 · created 0 · failed 0 ·
 *    status success 로 보고했다. failed 0 은 「실패가 없었다」가 아니라
 *    「실패를 세지 않았다」였다.
 */
const kakaoErrors: Record<string, number> = {};

async function searchNearby(lat: number, lng: number, category: string, radius: number): Promise<{ name: string; distance: number } | null> {
  if (!KAKAO_KEY) { kakaoErrors.NO_KEY = (kakaoErrors.NO_KEY ?? 0) + 1; return null; }
  try {
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${category}&x=${lng}&y=${lat}&radius=${radius}&sort=distance&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      const body = await res.text();
      const kind = /disabled .*service/i.test(body) ? 'SERVICE_DISABLED' : `HTTP_${res.status}`;
      kakaoErrors[kind] = (kakaoErrors[kind] ?? 0) + 1;
      return null;
    }
    const j = await res.json();
    const doc = j?.documents?.[0];
    if (!doc) return null;
    return { name: doc.place_name, distance: parseInt(doc.distance) };
  } catch { return null; }
}

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('apt-enrich-location', async () => {
    if (!KAKAO_KEY) return { processed: 0, metadata: { error: 'KAKAO_REST_API_KEY not set' } };

    // ⚠️ 모듈 스코프 카운터다 — warm 인스턴스에서 이전 실행분이 «남는다». 매번 비운다.
    for (const k of Object.keys(kakaoErrors)) delete kakaoErrors[k];

    const admin = getSupabaseAdmin();

    // 인근역 없는 현장 (좌표 있는 것만)
    const { data: sites } = await (admin as any).from('apt_sites')
      .select('id, name, latitude, longitude')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .or('nearby_station.is.null,nearby_station.eq.')
      .order('page_views', { ascending: false, nullsFirst: false })
      .limit(100);

    if (!sites?.length) return { processed: 0, metadata: { reason: 'all_enriched' } };

    let updated = 0;
    for (const site of sites) {
      try {
        const updateData: Record<string, any> = {};

        // 지하철역 (SW8 = 지하철역)
        const station = await searchNearby(site.latitude, site.longitude, 'SW8', 2000);
        if (station) {
          updateData.nearby_station = `${station.name} (${station.distance}m)`;
          // 교통 점수 산출: 500m 이내 100점, 1km 80점, 2km 50점
          const transitScore = station.distance <= 300 ? 100 : station.distance <= 500 ? 90 : station.distance <= 800 ? 75 : station.distance <= 1200 ? 60 : station.distance <= 2000 ? 40 : 20;
          updateData.transit_score = transitScore;
        }

        // 초등학교 (SC4 = 학교)
        const school = await searchNearby(site.latitude, site.longitude, 'SC4', 1500);
        if (school) {
          updateData.school_district = school.name;
        }

        // 편의시설: 대형마트 (MT1), 병원 (HP8)
        const mart = await searchNearby(site.latitude, site.longitude, 'MT1', 1500);
        const hospital = await searchNearby(site.latitude, site.longitude, 'HP8', 1500);
        if (mart || hospital) {
          const facilities: Record<string, any> = {};
          if (mart) facilities.mart = { name: mart.name, distance: mart.distance };
          if (hospital) facilities.hospital = { name: hospital.name, distance: hospital.distance };
          updateData.nearby_facilities = facilities;
        }

        if (Object.keys(updateData).length > 0) {
          await (admin as any).from('apt_sites').update(updateData).eq('id', site.id);
          updated++;
        }

        // Rate limit: 카카오 API 분당 60건 → 사이트당 4건 = 15사이트/분
        await new Promise(r => setTimeout(r, 500));
      } catch { /* skip */ }
    }

    // ⛔ 「호출이 거부됐다」를 «실패로 센다». 이 줄이 없어서 엿새 동안 success 였다.
    const blocked = Object.keys(kakaoErrors).length > 0;
    return {
      processed: sites.length,
      updated,
      failed: blocked ? sites.length - updated : 0,
      metadata: {
        kakao_key: !!KAKAO_KEY,
        updated,
        kakao_errors: kakaoErrors,
        blocked,
        blocked_reason: kakaoErrors.SERVICE_DISABLED
          ? '카카오 개발자 콘솔에서 OPEN_MAP_AND_LOCAL(로컬) 서비스가 꺼져 있다 — 사람이 켜야 한다'
          : null,
      },
    };
  });
  return NextResponse.json(result);
}
