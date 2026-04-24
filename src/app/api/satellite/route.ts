import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const revalidate = 2592000; // 30일

// Web Mercator 타일 좌표 변환
function lat2tile(lat: number, zoom: number) {
  return Math.floor(
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) /
        Math.PI) /
      2) *
      Math.pow(2, zoom),
  );
}
function lng2tile(lng: number, zoom: number) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, immutable',
} as const;

async function fetchTile(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'kadeora.app/1.0 (+https://kadeora.app)' },
      next: { revalidate: 2592000 },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': contentType, ...CACHE_HEADERS },
    });
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const zoomRaw = parseInt(searchParams.get('zoom') || '18', 10);
  const apt = searchParams.get('apt') || '';

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    return new Response('missing or invalid lat/lng', { status: 400 });
  }
  const zoom = Math.max(1, Math.min(19, Number.isFinite(zoomRaw) ? zoomRaw : 18));

  const x = lng2tile(lng, zoom);
  const y = lat2tile(lat, zoom);

  // 1) Esri World Imagery (공개, 인증 불필요)
  const esri = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
  const tile = await fetchTile(esri);
  if (tile) return tile;

  // 2) OSM 기반 위성 호환 (Wikimedia) — Esri 실패 시 대체
  const osm = `https://tiles.wmflabs.org/osm/${zoom}/${x}/${y}.png`;
  const osmTile = await fetchTile(osm);
  if (osmTile) return osmTile;

  // 3) 최종 fallback — 절대 실패하지 않는 OG 차트로 리다이렉트
  const fallback = `${origin}/api/og-chart?apt=${encodeURIComponent(apt)}`;
  return Response.redirect(fallback, 302);
}
