/**
 * 세션 147 D2 — 통합 geocoding 래퍼. 4단 fallback.
 *
 * 1. Kakao Local API (KAKAO_REST_API_KEY, "OPEN_MAP_AND_LOCAL" 권한 필요)
 * 2. Naver Cloud Maps Geocoding (NAVER_CLOUD_ID / NAVER_CLOUD_SECRET)
 * 3. VWorld (VWORLD_API_KEY 필요) — 주소→지오 API
 * 4. Nominatim (OpenStreetMap) — 무료, 키 불필요, rate limit 1/sec
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  source: 'kakao' | 'naver' | 'vworld' | 'nominatim';
  matched?: string;
}

async function tryKakao(query: string): Promise<GeocodeResult | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const d = body?.documents?.[0];
    if (d?.x && d?.y) return { lat: parseFloat(d.y), lng: parseFloat(d.x), source: 'kakao', matched: query };
  } catch { /* fall-through */ }
  return null;
}

async function tryNaver(query: string): Promise<GeocodeResult | null> {
  const id = process.env.NAVER_CLOUD_ID;
  const secret = process.env.NAVER_CLOUD_SECRET;
  if (!id || !secret) return null;
  try {
    const res = await fetch(`https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': id,
        'X-NCP-APIGW-API-KEY': secret,
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const d = body?.addresses?.[0];
    if (d?.x && d?.y) return { lat: parseFloat(d.y), lng: parseFloat(d.x), source: 'naver', matched: query };
  } catch {}
  return null;
}

async function tryVworld(query: string): Promise<GeocodeResult | null> {
  const key = process.env.VWORLD_API_KEY || process.env.VWORLD_KEY;
  if (!key) return null;
  try {
    const url = `https://api.vworld.kr/req/address?service=address&request=getCoord&version=2.0&crs=epsg:4326&type=parcel&address=${encodeURIComponent(query)}&format=json&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const body = await res.json();
    const result = body?.response?.result;
    if (result?.point?.x && result?.point?.y) {
      return { lat: parseFloat(result.point.y), lng: parseFloat(result.point.x), source: 'vworld', matched: query };
    }
  } catch {}
  return null;
}

async function tryNominatim(query: string): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ko`, {
      headers: { 'User-Agent': 'kadeora-geocode/1.0 (kadeora.app@gmail.com)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const d = Array.isArray(body) ? body[0] : null;
    if (d?.lat && d?.lon) return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), source: 'nominatim', matched: query };
  } catch {}
  return null;
}

function cleanAddress(addr: string): string {
  return addr
    .replace(/특례시/g, '시')
    .replace(/\([^)]*\)/g, '')
    .replace(/외\s*\d+\s*필지.*$/, '')
    .replace(/\s*일원\s*.*$/, '')
    .replace(/\s*지구.*$/, '')
    .replace(/,.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function geocodeAddress(address: string, name?: string): Promise<GeocodeResult | null> {
  const candidates = Array.from(new Set([
    address,
    cleanAddress(address),
    cleanAddress(address).split(' ').slice(0, 4).join(' '),
    name,
  ].filter(Boolean))) as string[];

  for (const provider of [tryKakao, tryNaver, tryVworld, tryNominatim]) {
    for (const q of candidates) {
      const r = await provider(q);
      if (r) return r;
      await new Promise((r) => setTimeout(r, 200));
    }
    // Nominatim rate limit 보호 (1 req/sec)
    if (provider === tryNominatim) await new Promise((r) => setTimeout(r, 1100));
  }
  return null;
}
