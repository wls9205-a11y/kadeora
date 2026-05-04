// lat/lng → Kakao reverse geocoding → 17-region short name.
// 클라이언트 RegionPicker 의 '📍 현재 위치' 버튼이 호출.
// s230b: runtime edge → nodejs. Edge runtime fetch 가 카카오에 403 로 차단됨
// (같은 KAKAO_REST_API_KEY 로 nodejs cron 은 200 OK).

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

const KR_SHORT_MAP: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  강원도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라북도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

const KR_WHITELIST = new Set<string>([
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]);

interface KakaoDocument {
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  region_type?: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const latRaw = url.searchParams.get('lat');
  const lngRaw = url.searchParams.get('lng');
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!latRaw || !lngRaw || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return jsonResponse({ error: 'invalid_coords' }, 400);
  }

  // Korea bounding box.
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return jsonResponse({ error: 'out_of_bounds' }, 400);
  }

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return jsonResponse({ error: 'kakao_key_missing' }, 503);
  }

  const kakaoUrl = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`;

  let res: Response;
  try {
    res = await fetch(kakaoUrl, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return jsonResponse({ error: 'kakao_fetch_failed' }, 502);
  }

  if (!res.ok) {
    let kakaoBody: any = null;
    try { kakaoBody = await res.json(); } catch {}
    return NextResponse.json({
      error: 'kakao_bad_status',
      status: res.status,
      kakao_msg: kakaoBody?.msg || null,
      kakao_code: kakaoBody?.code || null,
    }, { status: 502 });
  }

  let data: { documents?: KakaoDocument[] } | null = null;
  try {
    data = (await res.json()) as { documents?: KakaoDocument[] };
  } catch {
    return jsonResponse({ error: 'kakao_bad_json' }, 502);
  }

  const docs = data?.documents ?? [];
  if (!Array.isArray(docs) || docs.length === 0) {
    return jsonResponse({ error: 'no_documents' }, 404);
  }

  const doc = docs.find((d) => d.region_type === 'B') ?? docs[0];
  const raw = doc.region_1depth_name ?? '';
  const region = KR_SHORT_MAP[raw] ?? raw;

  if (!KR_WHITELIST.has(region)) {
    return jsonResponse({ error: 'unknown_region', raw }, 422);
  }

  return jsonResponse(
    { region, sigungu: doc.region_2depth_name || null },
    200,
  );
}
