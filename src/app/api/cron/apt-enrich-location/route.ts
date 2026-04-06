import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

async function searchNearby(lat: number, lng: number, category: string, radius: number): Promise<{ name: string; distance: number } | null> {
  if (!KAKAO_KEY) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${category}&x=${lng}&y=${lat}&radius=${radius}&sort=distance&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = await res.json();
    const doc = j?.documents?.[0];
    if (!doc) return null;
    return { name: doc.place_name, distance: parseInt(doc.distance) };
  } catch { return null; }
}

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('apt-enrich-location', async () => {
    if (!KAKAO_KEY) return { processed: 0, metadata: { error: 'KAKAO_REST_API_KEY not set' } };

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

    return { processed: sites.length, updated, metadata: { kakao_key: !!KAKAO_KEY } };
  });
  return NextResponse.json(result);
}
