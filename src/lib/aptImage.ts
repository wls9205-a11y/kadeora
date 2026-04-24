/**
 * apt_sites / apt_complex_profiles 이미지 픽킹 공용 헬퍼 (s163).
 *
 * 우선순위:
 *   1) images[] 배열의 실제 외부 이미지 (OG/og_fallback/og_generated source 및
 *      /api/og URL 은 제외). object 면 thumbnail > thumb > url, 문자열이면 그대로.
 *   2) satellite_image_url (s161 /api/satellite endpoint 라이브)
 *   3) og_image_url (단 /api/og 자체 SVG 는 fallback 으로만 사용)
 *
 * 서버/클라이언트 어디서든 사용 가능한 순수 함수.
 */

type AnyImg = string | { url?: string; thumbnail?: string; thumb?: string; source?: string | null } | null | undefined;

export function pickRealImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const im of images as AnyImg[]) {
    if (!im) continue;
    const u = typeof im === 'string' ? im : (im.url || im.thumbnail || im.thumb);
    if (!u || typeof u !== 'string') continue;
    if (typeof im === 'object') {
      const src = (im.source || '').toLowerCase();
      if (src === 'og' || src === 'og_fallback' || src === 'og_generated') continue;
    }
    if (u.includes('/api/og')) continue;
    const picked = typeof im === 'string'
      ? u
      : (im.thumbnail || im.thumb || im.url || u);
    return picked || null;
  }
  return null;
}

export function pickBestAptImage(site: {
  images?: unknown;
  satellite_image_url?: string | null;
  og_image_url?: string | null;
}): string | null {
  const sat = site.satellite_image_url && String(site.satellite_image_url).length > 10
    ? site.satellite_image_url : null;
  const real = pickRealImage(site.images);
  const ogExternal = site.og_image_url && !site.og_image_url.includes('/api/og')
    ? site.og_image_url : null;
  const ogGeneric = site.og_image_url || null;
  return sat || real || ogExternal || ogGeneric;
}

/**
 * PostgREST `.in()` 은 내부적으로 URL 쿼리스트링을 사용해 긴 배열 시
 * URL 한계(≈16KB)를 초과함. chunk 로 쪼개서 배치 실행.
 */
export async function batchedInQuery<T>(
  runQuery: (chunk: string[]) => Promise<{ data: T[] | null }>,
  values: string[],
  chunkSize = 50,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    const slice = values.slice(i, i + chunkSize);
    const { data } = await runQuery(slice);
    if (data && data.length) out.push(...data);
  }
  return out;
}
